import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { badRequest, ok, parseBody, serverError, unauthorized } from "../lib/http";
import { isAdminEmail, signSessionToken, verifyMagicLinkToken } from "../lib/auth";

interface VerifyBody {
  token: string;
}

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const { token } = parseBody<VerifyBody>(event.body);
    if (!token) return badRequest("Missing token.");

    let payload;
    try {
      payload = await verifyMagicLinkToken(token);
    } catch {
      return unauthorized("This link is invalid or has expired. Request a new one.");
    }

    const isAdmin = isAdminEmail(payload.email);
    const sessionToken = await signSessionToken({
      sub: payload.email,
      fullName: payload.fullName,
      isAdmin,
    });

    return ok({
      sessionToken,
      user: { email: payload.email, fullName: payload.fullName, isAdmin },
    });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
