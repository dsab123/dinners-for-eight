export type Role = "host" | "guest";

export interface BaseRegistration {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  address: string;
  lat: number;
  lng: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Admin hard-override of this member's role for matching. When set, the
   * matcher treats them as this role and never auto-switches them, regardless
   * of what they registered as or their `flexibleRole` preference.
   */
  forcedRole?: Role;
  /** Willing to switch to the opposite role if it helps balance the numbers. */
  flexibleRole?: boolean;
  // Details for the opposite role, captured only when flexibleRole is set:
  switchCapacity?: number; // guest -> host: how many they could seat
  switchFlex?: number; //     guest -> host: give-or-take
  switchAdults?: number; //   host -> guest: party adults
  switchChildren?: number; // host -> guest: party children
}

export interface HostRegistration extends BaseRegistration {
  role: "host";
  /** "Comfortably host, give or take a few" -> a target plus flex. */
  targetCapacity: number;
  flex: number;
}

export interface GuestRegistration extends BaseRegistration {
  role: "guest";
  adults: number;
  children: number;
}

export type Registration = HostRegistration | GuestRegistration;

export interface RegistrationsFile {
  registrations: Registration[];
}

export interface MatchAssignment {
  hostId: string;
  guestIds: string[];
  assignedCount: number;
  targetCapacity: number;
}

export interface RoleSwitch {
  id: string;
  fromRole: Role;
  toRole: Role;
}

export interface MatchRun {
  id: string;
  createdAt: string;
  assignments: MatchAssignment[];
  unmatchedGuestIds: string[];
  /** People the matcher flipped roles for to balance hosts vs. guests. */
  switched?: RoleSwitch[];
}

export interface MatchesFile {
  runs: MatchRun[];
}

/**
 * Runtime-editable config for the event date and group-email copy, set from
 * the admin dashboard so neither needs a redeploy to change.
 */
export interface AppSettings {
  /** Human-readable dinner date (e.g. "July 19, 2026"), or "" if not set. */
  eventDate: string;
  /**
   * Optional override for the group-email subject. "" uses the built-in
   * default (which mentions eventDate when set). Supports {{eventDate}},
   * {{roster}}, {{hostName}}, {{hostAddress}} placeholders.
   */
  emailSubject: string;
  /** Optional override for the group-email body, same placeholders as above. */
  emailBody: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  eventDate: "",
  emailSubject: "",
  emailBody: "",
};

export interface SessionTokenPayload {
  sub: string; // email
  fullName: string;
  isAdmin: boolean;
}

export interface MagicLinkTokenPayload {
  email: string;
  fullName: string;
}
