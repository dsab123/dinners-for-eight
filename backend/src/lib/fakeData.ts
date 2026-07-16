import type { Registration } from "./types";

/**
 * A fixed set of fake hosts and guests scattered around Northern Virginia,
 * used by the admin "Load test data" button so the dashboard, map, matching,
 * CSV, and group emails can be exercised without creating real accounts.
 *
 * Emails are all `@example.test` (a reserved, non-deliverable domain) so they
 * stand out and never reach a real inbox. IDs are stable, so re-seeding
 * upserts rather than duplicating.
 */
const FAKE_HOSTS: Omit<Registration & { role: "host" }, "createdAt" | "updatedAt">[] = [
  { id: "fake-h1", role: "host", fullName: "Grace Miller", email: "grace.miller@example.test", address: "9500 Grant Ave, Manassas, VA 20110", lat: 38.7509, lng: -77.4753, targetCapacity: 8, flex: 2 },
  { id: "fake-h2", role: "host", fullName: "Paul Bennett", email: "paul.bennett@example.test", address: "7500 Iron Bridge Rd, Gainesville, VA 20155", lat: 38.7959, lng: -77.6136, targetCapacity: 6, flex: 1 },
  { id: "fake-h3", role: "host", fullName: "Ruth Carter", email: "ruth.carter@example.test", address: "40 Culpeper St, Warrenton, VA 20186", lat: 38.7135, lng: -77.7955, targetCapacity: 10, flex: 3 },
  { id: "fake-h4", role: "host", fullName: "Sam Diaz", email: "sam.diaz@example.test", address: "10800 Nokesville Rd, Bristow, VA 20136", lat: 38.7215, lng: -77.5397, targetCapacity: 6, flex: 2 },
];

const FAKE_GUESTS: Omit<Registration & { role: "guest" }, "createdAt" | "updatedAt">[] = [
  { id: "fake-g1", role: "guest", fullName: "Hannah Adams", email: "hannah.adams@example.test", address: "9250 Center St, Manassas, VA 20110", lat: 38.7512, lng: -77.4712, adults: 2, children: 1 },
  { id: "fake-g2", role: "guest", fullName: "Noah Brooks", email: "noah.brooks@example.test", address: "8100 Ashton Ave, Manassas, VA 20109", lat: 38.7833, lng: -77.4869, adults: 1, children: 0 },
  { id: "fake-g3", role: "guest", fullName: "Ella Fisher", email: "ella.fisher@example.test", address: "7200 Wellington Rd, Gainesville, VA 20155", lat: 38.8021, lng: -77.6011, adults: 2, children: 3 },
  { id: "fake-g4", role: "guest", fullName: "Liam Gray", email: "liam.gray@example.test", address: "5100 Wellington Rd, Gainesville, VA 20155", lat: 38.7887, lng: -77.6203, adults: 2, children: 0 },
  { id: "fake-g5", role: "guest", fullName: "Mia Hughes", email: "mia.hughes@example.test", address: "251 W Lee Hwy, Warrenton, VA 20186", lat: 38.7189, lng: -77.8012, adults: 1, children: 2 },
  { id: "fake-g6", role: "guest", fullName: "Owen Kelly", email: "owen.kelly@example.test", address: "360 Broadview Ave, Warrenton, VA 20186", lat: 38.7241, lng: -77.7889, adults: 2, children: 2 },
  { id: "fake-g7", role: "guest", fullName: "Ava Lopez", email: "ava.lopez@example.test", address: "12500 Bristow Rd, Bristow, VA 20136", lat: 38.7301, lng: -77.5442, adults: 2, children: 1 },
  { id: "fake-g8", role: "guest", fullName: "Jack Nolan", email: "jack.nolan@example.test", address: "9800 Godwin Dr, Manassas, VA 20110", lat: 38.7466, lng: -77.4831, adults: 1, children: 0 },
];

export function buildFakeRegistrations(now: string): Registration[] {
  return [...FAKE_HOSTS, ...FAKE_GUESTS].map((r) => ({
    ...r,
    createdAt: now,
    updatedAt: now,
  })) as Registration[];
}
