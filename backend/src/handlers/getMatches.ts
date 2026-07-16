import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { forbidden, ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import { MATCHES_KEY, readJson } from "../lib/store";
import type { MatchesFile } from "../lib/types";

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(event.headers?.authorization ?? event.headers?.Authorization);
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    const { data } = await readJson<MatchesFile>(MATCHES_KEY, { runs: [] });

    return ok({ latestRun: data.runs[0] ?? null });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
