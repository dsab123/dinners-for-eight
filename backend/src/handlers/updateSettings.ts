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
import { SETTINGS_KEY, writeJson } from "../lib/store";
import type { AppSettings } from "../lib/types";

/**
 * Admin-only: saves the event date and/or group-email copy overrides. Any
 * field left blank falls back to the built-in default behavior (see
 * lib/email.ts).
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(
      event.headers?.authorization ?? event.headers?.Authorization
    );
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    let body: Record<string, unknown>;
    try {
      body = parseBody<Record<string, unknown>>(event.body);
    } catch {
      return badRequest("Invalid request body.");
    }

    const { eventDate, emailSubject, emailBody } = body;
    if (
      typeof eventDate !== "string" ||
      typeof emailSubject !== "string" ||
      typeof emailBody !== "string"
    ) {
      return badRequest(
        "eventDate, emailSubject, and emailBody must all be strings."
      );
    }

    const settings: AppSettings = { eventDate, emailSubject, emailBody };
    await writeJson(SETTINGS_KEY, settings);

    return ok({ settings });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
