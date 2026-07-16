import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { forbidden, ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import { REGISTRATIONS_KEY, updateJson } from "../lib/store";
import { buildFakeRegistrations } from "../lib/fakeData";
import type { RegistrationsFile } from "../lib/types";

/**
 * Admin-only: loads a fixed set of fake hosts/guests for testing. Upserts by
 * id, so it never clobbers real registrations and clicking it repeatedly is
 * idempotent. Clear everything afterward with the Wipe button.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(
      event.headers?.authorization ?? event.headers?.Authorization
    );
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    const now = new Date().toISOString();
    const fakes = buildFakeRegistrations(now);

    const updated = await updateJson<RegistrationsFile>(
      REGISTRATIONS_KEY,
      { registrations: [] },
      (current) => {
        const byId = new Map(current.registrations.map((r) => [r.id, r]));
        for (const fake of fakes) byId.set(fake.id, fake);
        return { registrations: [...byId.values()] };
      }
    );

    return ok({ added: fakes.length, total: updated.registrations.length });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
