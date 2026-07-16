import { SignJWT, jwtVerify } from "jose";
import type { MagicLinkTokenPayload, SessionTokenPayload } from "./types";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Short-lived token embedded in the magic-link email. */
export async function signMagicLinkToken(
  payload: MagicLinkTokenPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyMagicLinkToken(
  token: string
): Promise<MagicLinkTokenPayload> {
  const { payload } = await jwtVerify(token, secret);
  return { email: payload.email as string, fullName: payload.fullName as string };
}

/** Longer-lived token the frontend keeps after a successful magic-link login. */
export async function signSessionToken(
  payload: SessionTokenPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<SessionTokenPayload> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    fullName: payload.fullName as string,
    isAdmin: Boolean(payload.isAdmin),
  };
}

export function bearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}
