import type { GuestRegistration, HostRegistration } from "../types";

export type Registration = HostRegistration | GuestRegistration;

/**
 * Single source of truth for the registration columns shared by the CSV export
 * and the in-app registrations view, so the two never drift apart.
 */
export const REGISTRATION_COLUMNS: {
  header: string;
  value: (r: Registration) => string | number;
}[] = [
  { header: "name", value: (r) => r.fullName },
  { header: "email", value: (r) => r.email },
  { header: "role", value: (r) => r.role },
  { header: "address", value: (r) => r.address },
  { header: "adults", value: (r) => (r.role === "guest" ? r.adults : "") },
  { header: "children", value: (r) => (r.role === "guest" ? r.children : "") },
  { header: "targetCapacity", value: (r) => (r.role === "host" ? r.targetCapacity : "") },
  { header: "flex", value: (r) => (r.role === "host" ? r.flex : "") },
  { header: "notes", value: (r) => r.notes ?? "" },
  { header: "createdAt", value: (r) => r.createdAt },
  { header: "updatedAt", value: (r) => r.updatedAt },
];

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadRegistrationsCsv(
  hosts: HostRegistration[],
  guests: GuestRegistration[]
) {
  const rows: Registration[] = [...hosts, ...guests];
  const lines = [
    REGISTRATION_COLUMNS.map((c) => c.header).join(","),
    ...rows.map((r) => REGISTRATION_COLUMNS.map((c) => csvCell(c.value(r))).join(",")),
  ];
  // Prepend a BOM so Excel opens it as UTF-8.
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dinners-for-eight-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
