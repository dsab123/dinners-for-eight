import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { badRequest, ok, parseBody, serverError } from "../lib/http";
import { signMagicLinkToken } from "../lib/auth";
import { sendMagicLinkEmail } from "../lib/email";

interface RequestLinkBody {
  email: string;
  fullName: string;
}

const APP_URL = process.env.APP_URL!;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const { email, fullName } = parseBody<RequestLinkBody>(event.body);

    if (!email || !EMAIL_RE.test(email)) {
      return badRequest("Enter a valid email address.");
    }
    if (!fullName || fullName.trim().length < 2) {
      return badRequest("Enter your full name.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const token = await signMagicLinkToken({
      email: normalizedEmail,
      fullName: fullName.trim(),
    });

    const link = `${APP_URL}/verify?token=${encodeURIComponent(token)}`;
    await sendMagicLinkEmail(normalizedEmail, fullName.trim(), link);

    return ok({ message: "Check your email for a sign-in link." });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
