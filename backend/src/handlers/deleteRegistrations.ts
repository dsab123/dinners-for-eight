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
import type { RegistrationsFile } from "../lib/types";

/**
 * Admin-only targeted delete: removes the registrations whose ids are listed
 * in the request body. Existing match runs are left as-is (the dashboard
 * tolerates ids it can't resolve); re-run matching to refresh them.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(
      event.headers?.authorization ?? event.headers?.Authorization
    );
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    let ids: unknown;
    try {
      ({ ids } = parseBody<{ ids: unknown }>(event.body));
    } catch {
      return badRequest("Invalid request body.");
    }
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.some((id) => typeof id !== "string")
    ) {
      return badRequest("Provide a non-empty array of registration ids.");
    }
    const idSet = new Set(ids as string[]);

    let removed = 0;
    const result = await updateJson<RegistrationsFile>(
      REGISTRATIONS_KEY,
      { registrations: [] },
      (current) => {
        const kept = current.registrations.filter((r) => !idSet.has(r.id));
        removed = current.registrations.length - kept.length;
        return { registrations: kept };
      }
    );

    return ok({ removed, total: result.registrations.length });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
