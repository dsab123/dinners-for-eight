import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import { MATCHES_KEY, REGISTRATIONS_KEY, readJson } from "../lib/store";
import { sendGroupEmail } from "../lib/email";
import type { MatchesFile, RegistrationsFile } from "../lib/types";

function firstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

/**
 * Admin-only: for the most recent match run, emails each group (its host plus
 * assigned guests) together to kick off a coordination thread. Sends one email
 * per group with everyone on the To line so a reply-all reaches the whole
 * table. Groups without any guests are skipped.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(
      event.headers?.authorization ?? event.headers?.Authorization
    );
    if (!token) return unauthorized();

    const session = await verifySessionToken(token);
    if (!session.isAdmin) return forbidden("Admins only.");

    const [{ data: regs }, { data: matches }] = await Promise.all([
      readJson<RegistrationsFile>(REGISTRATIONS_KEY, { registrations: [] }),
      readJson<MatchesFile>(MATCHES_KEY, { runs: [] }),
    ]);

    const latestRun = matches.runs[0];
    if (!latestRun || latestRun.assignments.length === 0) {
      return badRequest("Run matching first, then email the groups.");
    }

    const byId = new Map(regs.registrations.map((r) => [r.id, r]));

    let emailed = 0;
    let skipped = 0;
    const failed: string[] = [];

    for (const assignment of latestRun.assignments) {
      const host = byId.get(assignment.hostId);
      const guests = assignment.guestIds
        .map((id) => byId.get(id))
        .filter((g): g is NonNullable<typeof g> => Boolean(g));

      if (!host || guests.length === 0) {
        skipped++;
        continue;
      }

      const recipients = [host.email, ...guests.map((g) => g.email)];
      const memberNames = [
        firstName(host.fullName),
        ...guests.map((g) => firstName(g.fullName)),
      ];

      try {
        await sendGroupEmail({
          recipients,
          hostName: host.fullName,
          hostAddress: host.address,
          memberNames,
        });
        emailed++;
      } catch (err) {
        console.error(`Group email failed for host ${host.id}:`, err);
        failed.push(host.fullName);
      }
    }

    return ok({ emailed, skipped, failed });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
