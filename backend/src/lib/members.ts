import membersData from "../data/members.json";
import { bestNameMatch } from "./fuzzy";

export interface Member {
  name: string;
  address: string;
}

const MEMBERS: Member[] = (membersData as { members: Member[] }).members ?? [];

/**
 * Fuzzy-match a name against the church directory and return the best
 * candidate's address, or null if nothing is a confident match. Used to
 * pre-fill a signed-in person's own address so they don't retype it.
 */
export function lookupMemberByName(name: string): Member | null {
  if (!name || !name.trim()) return null;
  const match = bestNameMatch(name, MEMBERS, (m) => m.name);
  return match ? match.item : null;
}
