import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { forbidden, ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import {
  MATCHES_KEY,
  REGISTRATIONS_KEY,
  readJson,
  updateJson,
} from "../lib/store";
import { runMatching } from "../lib/matching";
import type {
  GuestRegistration,
  HostRegistration,
  MatchesFile,
  RegistrationsFile,
} from "../lib/types";

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(event.headers?.authorization ?? event.headers?.Authorization);
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    const { data } = await readJson<RegistrationsFile>(REGISTRATIONS_KEY, {
      registrations: [],
    });

    const hosts = data.registrations.filter(
      (r): r is HostRegistration => r.role === "host"
    );
    const guests = data.registrations.filter(
      (r): r is GuestRegistration => r.role === "guest"
    );

    const result = runMatching(hosts, guests);

    const run = {
      id: randomId(),
      createdAt: new Date().toISOString(),
      ...result,
    };

    const updated = await updateJson<MatchesFile>(
      MATCHES_KEY,
      { runs: [] },
      (current) => ({ runs: [run, ...current.runs].slice(0, 20) })
    );

    return ok({ run, previousRuns: updated.runs.length - 1 });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
