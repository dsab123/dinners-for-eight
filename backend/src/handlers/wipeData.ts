import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { forbidden, ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import { MATCHES_KEY, REGISTRATIONS_KEY, writeJson } from "../lib/store";
import type { MatchesFile, RegistrationsFile } from "../lib/types";

/**
 * Admin-only "wipe": resets the whole round by emptying both the
 * registrations and the match history. People keep sign-in access (auth is
 * stateless and separate) and simply re-register. Matches are cleared too so
 * the dashboard doesn't show assignments pointing at deleted registrations.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(
      event.headers?.authorization ?? event.headers?.Authorization
    );
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    await writeJson<RegistrationsFile>(REGISTRATIONS_KEY, { registrations: [] });
    await writeJson<MatchesFile>(MATCHES_KEY, { runs: [] });

    return ok({ wiped: true });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
