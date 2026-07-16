import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { badRequest, ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import { geocodeAddressOrDefault } from "../lib/geocode";

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(event.headers?.authorization ?? event.headers?.Authorization);
    if (!token) return unauthorized();
    await verifySessionToken(token);

    const address = event.queryStringParameters?.address;
    if (!address || address.trim().length < 3) {
      return badRequest("Provide an address to geocode.");
    }

    // Falls back to the default location if the address doesn't resolve to a
    // confident US match, so a bad entry never lands somewhere random abroad.
    const result = await geocodeAddressOrDefault(address.trim());
    return ok(result);
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
