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
  /** Admin hard-override of role for matching (never auto-switched). */
  forcedRole?: Role;
  flexibleRole?: boolean;
  switchCapacity?: number;
  switchFlex?: number;
  switchAdults?: number;
  switchChildren?: number;
}

export interface HostRegistration extends BaseRegistration {
  role: "host";
  targetCapacity: number;
  flex: number;
}

export interface GuestRegistration extends BaseRegistration {
  role: "guest";
  adults: number;
  children: number;
}

export type Registration = HostRegistration | GuestRegistration;

export interface CurrentUser {
  email: string;
  fullName: string;
  isAdmin: boolean;
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
  switched?: RoleSwitch[];
}

export interface AppSettings {
  eventDate: string;
  emailSubject: string;
  emailBody: string;
}
