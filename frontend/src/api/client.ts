declare global {
  interface Window {
    __DINNERS_FOR_EIGHT_CONFIG__?: {
      apiUrl: string;
      mapboxToken: string;
    };
  }
}

export function getConfig() {
  const config = window.__DINNERS_FOR_EIGHT_CONFIG__;
  if (!config) {
    throw new Error(
      "App config is missing. Expected window.__DINNERS_FOR_EIGHT_CONFIG__ to be set by config.js."
    );
  }
  return config;
}

const SESSION_STORAGE_KEY = "d4e_session_token";

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

export function setSessionToken(token: string) {
  localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { apiUrl } = getConfig();
  const token = getSessionToken();

  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

export const api = {
  requestMagicLink: (email: string, fullName: string) =>
    request<{ message: string }>("/auth/request-link", {
      method: "POST",
      body: JSON.stringify({ email, fullName }),
    }),

  verifyMagicLink: (token: string) =>
    request<{ sessionToken: string; user: { email: string; fullName: string; isAdmin: boolean } }>(
      "/auth/verify",
      { method: "POST", body: JSON.stringify({ token }) }
    ),

  me: () => request<{ user: { email: string; fullName: string; isAdmin: boolean } }>("/me"),

  geocode: (address: string) =>
    request<{ formattedAddress: string; lat: number; lng: number }>(
      `/geocode?address=${encodeURIComponent(address)}`
    ),

  register: (payload: Record<string, unknown>) =>
    request<{ registration: unknown }>("/registrations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  memberLookup: () =>
    request<{ match: { name: string; address: string } | null }>(
      "/members/lookup"
    ),

  adminListRegistrations: () =>
    request<{
      hostCount: number;
      guestUnitCount: number;
      guestPeopleCount: number;
      hosts: import("../types").HostRegistration[];
      guests: import("../types").GuestRegistration[];
    }>("/admin/registrations"),

  adminDeleteRegistrations: (ids: string[]) =>
    request<{ removed: number; total: number }>("/admin/registrations/delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  adminSetForcedRole: (id: string, role: "host" | "guest" | null) =>
    request<{ id: string; forcedRole: "host" | "guest" | null }>(
      "/admin/registrations/role",
      { method: "POST", body: JSON.stringify({ id, role }) }
    ),

  adminRunMatch: () =>
    request<{ run: import("../types").MatchRun }>("/admin/match", { method: "POST" }),

  adminGetLatestMatch: () =>
    request<{ latestRun: import("../types").MatchRun | null }>("/admin/match"),

  adminWipe: () =>
    request<{ wiped: boolean }>("/admin/wipe", { method: "POST" }),

  adminSimulate: () =>
    request<{ added: number; total: number }>("/admin/simulate", {
      method: "POST",
    }),

  adminEmailGroups: () =>
    request<{ emailed: number; skipped: number; failed: string[] }>(
      "/admin/email-groups",
      { method: "POST" }
    ),

  adminGetSettings: () =>
    request<{ settings: import("../types").AppSettings }>("/admin/settings"),

  adminUpdateSettings: (settings: import("../types").AppSettings) =>
    request<{ settings: import("../types").AppSettings }>("/admin/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
};

export { ApiError };
