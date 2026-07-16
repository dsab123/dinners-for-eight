import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import { lookupMemberByName } from "../lib/members";

/**
 * Returns the church-directory address for the *signed-in* person, matched
 * fuzzily on their own name. It deliberately ignores any client-supplied
 * name and uses the session's `fullName`, so a signed-in user can only ever
 * pre-fill their own address — not enumerate anyone else's.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(
      event.headers?.authorization ?? event.headers?.Authorization
    );
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);

    const match = lookupMemberByName(session.fullName);
    if (!match) return ok({ match: null });

    return ok({ match: { name: match.name, address: match.address } });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
