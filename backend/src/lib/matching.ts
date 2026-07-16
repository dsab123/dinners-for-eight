import type {
  GuestRegistration,
  HostRegistration,
  MatchAssignment,
  MatchRun,
  RoleSwitch,
} from "./types";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function guestSize(guest: GuestRegistration): number {
  return guest.adults + guest.children;
}

const DEFAULT_SWITCH_CAPACITY = 6;
const DEFAULT_SWITCH_FLEX = 2;

/**
 * How much random noise to add to each host's placement score, making matching
 * non-idempotent (re-runnable for variety). ~0.6 lets proximity ties and small
 * fill differences flip between runs while the fill term (~2 wide) still keeps
 * headcounts balanced. Set to 0 for fully deterministic matching.
 */
const MATCH_JITTER = 0.6;

function guestToHost(g: GuestRegistration): HostRegistration {
  return {
    ...g,
    role: "host",
    targetCapacity: g.switchCapacity ?? DEFAULT_SWITCH_CAPACITY,
    flex: g.switchFlex ?? DEFAULT_SWITCH_FLEX,
  };
}

function hostToGuest(h: HostRegistration): GuestRegistration {
  return {
    ...h,
    role: "guest",
    adults: h.switchAdults ?? 2,
    children: h.switchChildren ?? 0,
  };
}

interface Rebalanced {
  hosts: HostRegistration[];
  guests: GuestRegistration[];
  switched: RoleSwitch[];
}

/**
 * Apply admin-forced roles before anything else: a member with `forcedRole`
 * is moved to that role (using their switch details / defaults when crossing
 * over) and its id is returned in `lockedIds` so the automatic rebalance below
 * won't flip it back. This is a hard override, independent of `flexibleRole`.
 */
function applyForcedRoles(
  hosts: HostRegistration[],
  guests: GuestRegistration[]
): { hosts: HostRegistration[]; guests: GuestRegistration[]; lockedIds: Set<string> } {
  const outHosts: HostRegistration[] = [];
  const outGuests: GuestRegistration[] = [];
  const lockedIds = new Set<string>();

  for (const h of hosts) {
    if (h.forcedRole === "guest") {
      outGuests.push(hostToGuest(h));
      lockedIds.add(h.id);
    } else {
      if (h.forcedRole === "host") lockedIds.add(h.id);
      outHosts.push(h);
    }
  }
  for (const g of guests) {
    if (g.forcedRole === "host") {
      outHosts.push(guestToHost(g));
      lockedIds.add(g.id);
    } else {
      if (g.forcedRole === "guest") lockedIds.add(g.id);
      outGuests.push(g);
    }
  }

  return { hosts: outHosts, guests: outGuests, lockedIds };
}

/**
 * Before placing anyone, flip the roles of people who volunteered
 * (`flexibleRole`) when hosts and guests are out of balance:
 *  - too little host capacity for the guests → promote willing guests to hosts
 *  - far more seats than guests (empty tables) → demote willing hosts to guests
 * Uses the capacity / party size each person gave for their switch case.
 * Members in `lockedIds` (admin-forced) are never auto-switched.
 */
function rebalanceRoles(
  hosts: HostRegistration[],
  guests: GuestRegistration[],
  lockedIds: Set<string>
): Rebalanced {
  let effHosts = [...hosts];
  let effGuests = [...guests];
  const switched: RoleSwitch[] = [];

  const seats = () => effHosts.reduce((s, h) => s + h.targetCapacity, 0);
  const demand = () => effGuests.reduce((s, g) => s + guestSize(g), 0);

  // Case 1: not enough capacity → promote willing guests, smallest party
  // first (keep big families as guests, who most need a seat).
  const promotable = effGuests
    .filter(
      (g) => g.flexibleRole && (g.switchCapacity ?? 0) >= 1 && !lockedIds.has(g.id)
    )
    .sort((a, b) => guestSize(a) - guestSize(b));
  for (const g of promotable) {
    if (demand() <= seats()) break;
    effGuests = effGuests.filter((x) => x.id !== g.id);
    effHosts.push(guestToHost(g));
    switched.push({ id: g.id, fromRole: "guest", toRole: "host" });
  }

  // Case 2: too many seats → demote willing hosts, smallest capacity first,
  // but never past the point where demand would exceed seats, and never below
  // one remaining host.
  const demotable = effHosts
    .filter(
      (h) =>
        h.flexibleRole &&
        (h.switchAdults ?? 0) + (h.switchChildren ?? 0) >= 1 &&
        !lockedIds.has(h.id)
    )
    .sort((a, b) => a.targetCapacity - b.targetCapacity);
  for (const h of demotable) {
    const asGuest = hostToGuest(h);
    const party = guestSize(asGuest);
    if (effHosts.length > 1 && seats() - h.targetCapacity >= demand() + party) {
      effHosts = effHosts.filter((x) => x.id !== h.id);
      effGuests.push(asGuest);
      switched.push({ id: h.id, fromRole: "host", toRole: "guest" });
    }
  }

  return { hosts: effHosts, guests: effGuests, switched };
}

interface HostState {
  host: HostRegistration;
  assignedCount: number;
  guestIds: string[];
}

/**
 * Greedy matching that tries to:
 *  1. Never leave a host far short of their stated target if guests are
 *     available (equalization), while allowing the host's declared "flex"
 *     as reasonable overflow.
 *  2. Among hosts that are otherwise similarly under-filled, prefer the
 *     geographically closest one to the guest.
 *
 * Guest units (a whole household, adults+children) are placed one at a
 * time, largest households first, so a big family isn't left stranded
 * after smaller households have already filled up every host.
 */
export function runMatching(
  hosts: HostRegistration[],
  guests: GuestRegistration[]
): Pick<MatchRun, "assignments" | "unmatchedGuestIds" | "switched"> {
  // Hard admin overrides first, then automatic balancing of everyone else.
  const {
    hosts: forcedHosts,
    guests: forcedGuests,
    lockedIds,
  } = applyForcedRoles(hosts, guests);
  const {
    hosts: effHosts,
    guests: effGuests,
    switched,
  } = rebalanceRoles(forcedHosts, forcedGuests, lockedIds);

  const hostStates: HostState[] = effHosts.map((host) => ({
    host,
    assignedCount: 0,
    guestIds: [],
  }));

  // Largest households still go first (fairness — a big family shouldn't be
  // stranded), but ties in size are shuffled so re-running the match reshuffles
  // who's placed first. This, plus the score jitter below, makes matching
  // intentionally NON-idempotent: the same registrations produce different
  // (still valid) groupings each run, so an admin can "re-roll" for variety.
  const sortedGuests = [...effGuests]
    .map((g) => ({ g, r: Math.random() }))
    .sort((a, b) => guestSize(b.g) - guestSize(a.g) || a.r - b.r)
    .map((x) => x.g);

  const unmatchedGuestIds: string[] = [];

  for (const guest of sortedGuests) {
    const size = guestSize(guest);
    const candidates = hostStates.filter(
      (hs) =>
        hs.assignedCount + size <=
        hs.host.targetCapacity + hs.host.flex
    );

    const pool = candidates.length > 0 ? candidates : hostStates;
    if (pool.length === 0) {
      unmatchedGuestIds.push(guest.id);
      continue;
    }

    // Score = how under-filled the host is (bigger is better) combined
    // with proximity (closer is better). Fill ratio dominates so headcount
    // stays balanced; distance breaks ties among similarly-open hosts.
    let best: HostState | null = null;
    let bestScore = -Infinity;

    for (const hs of pool) {
      const fillRatio =
        hs.assignedCount / Math.max(hs.host.targetCapacity, 1);
      const distanceKm = haversineKm(guest, hs.host);
      const distancePenalty = Math.min(distanceKm / 50, 1); // cap influence at 50km
      // Random jitter breaks near-ties differently on each run. It's small
      // relative to the fill term (which spans ~2), so headcount balancing
      // still dominates; raise MATCH_JITTER for more variety at some cost to
      // proximity/fill optimality, lower it (toward 0) for stabler results.
      const jitter = (Math.random() - 0.5) * MATCH_JITTER;
      const score = -fillRatio * 2 - distancePenalty + jitter;

      if (score > bestScore) {
        bestScore = score;
        best = hs;
      }
    }

    if (!best) {
      unmatchedGuestIds.push(guest.id);
      continue;
    }

    best.assignedCount += size;
    best.guestIds.push(guest.id);
  }

  const assignments: MatchAssignment[] = hostStates.map((hs) => ({
    hostId: hs.host.id,
    guestIds: hs.guestIds,
    assignedCount: hs.assignedCount,
    targetCapacity: hs.host.targetCapacity,
  }));

  return { assignments, unmatchedGuestIds, switched };
}
