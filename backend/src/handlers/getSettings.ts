import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { forbidden, ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import { SETTINGS_KEY, readJson } from "../lib/store";
import { DEFAULT_SETTINGS } from "../lib/types";

/**
 * Admin-only: the event date and group-email copy, editable at runtime from
 * the dashboard so neither requires a redeploy to change. Falls back to the
 * deploy-time EVENT_DATE env var until an admin has explicitly saved one.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(
      event.headers?.authorization ?? event.headers?.Authorization
    );
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    const { data } = await readJson(SETTINGS_KEY, DEFAULT_SETTINGS);
    const eventDate = data.eventDate.trim() || (process.env.EVENT_DATE?.trim() ?? "");

    return ok({ settings: { ...data, eventDate } });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
