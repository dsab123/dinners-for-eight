import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(event.headers?.authorization ?? event.headers?.Authorization);
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    return ok({
      user: {
        email: session.sub,
        fullName: session.fullName,
        isAdmin: session.isAdmin,
      },
    });
  } catch (err) {
    return unauthorized("Your session has expired. Sign in again.");
  }
}
