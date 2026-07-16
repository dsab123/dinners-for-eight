import type { APIGatewayProxyEventV2 } from "aws-lambda";
import {
  badRequest,
  forbidden,
  ok,
  parseBody,
  serverError,
  unauthorized,
} from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import { REGISTRATIONS_KEY, updateJson } from "../lib/store";
import type { Registration, RegistrationsFile, Role } from "../lib/types";

/**
 * Admin-only: hard-override a member's role for matching, or clear the override
 * (role: null). This sets `forcedRole` on the registration; the matcher then
 * treats them as that role and won't auto-switch them.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(
      event.headers?.authorization ?? event.headers?.Authorization
    );
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    let body: { id: unknown; role: unknown };
    try {
      body = parseBody<{ id: unknown; role: unknown }>(event.body);
    } catch {
      return badRequest("Invalid request body.");
    }
    const { id, role } = body;
    if (typeof id !== "string" || !id) {
      return badRequest("A registration id is required.");
    }
    if (role !== "host" && role !== "guest" && role !== null) {
      return badRequest("role must be 'host', 'guest', or null.");
    }

    let found = false;
    await updateJson<RegistrationsFile>(
      REGISTRATIONS_KEY,
      { registrations: [] },
      (current) => ({
        registrations: current.registrations.map((r): Registration => {
          if (r.id !== id) return r;
          found = true;
          if (role === null) {
            const { forcedRole: _drop, ...rest } = r;
            return rest as Registration;
          }
          return { ...r, forcedRole: role as Role };
        }),
      })
    );

    if (!found) return badRequest("No registration with that id.");
    return ok({ id, forcedRole: role });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
