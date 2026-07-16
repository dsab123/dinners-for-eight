import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { forbidden, ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import { REGISTRATIONS_KEY, readJson } from "../lib/store";
import type { RegistrationsFile } from "../lib/types";

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(event.headers?.authorization ?? event.headers?.Authorization);
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    const { data } = await readJson<RegistrationsFile>(REGISTRATIONS_KEY, {
      registrations: [],
    });

    const hosts = data.registrations.filter((r) => r.role === "host");
    const guests = data.registrations.filter((r) => r.role === "guest");

    return ok({
      hostCount: hosts.length,
      guestUnitCount: guests.length,
      guestPeopleCount: guests.reduce(
        (sum, g) => sum + g.adults + g.children,
        0
      ),
      hosts,
      guests,
    });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
