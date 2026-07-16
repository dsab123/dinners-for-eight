import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { badRequest, ok, parseBody, serverError, unauthorized } from "../lib/http";
import { bearerToken, verifySessionToken } from "../lib/auth";
import {
  REGISTRATIONS_KEY,
  readJson,
  updateJson,
} from "../lib/store";
import { DEFAULT_RESULT } from "../lib/geocode";
import type { Registration, RegistrationsFile } from "../lib/types";

interface RegisterBody {
  role: "host" | "guest";
  address: string;
  lat: number;
  lng: number;
  notes?: string;
  // host fields
  targetCapacity?: number;
  flex?: number;
  // guest fields
  adults?: number;
  children?: number;
  // role-switch willingness + fallback details for the opposite role
  flexibleRole?: boolean;
  switchCapacity?: number; // guest willing to host
  switchFlex?: number;
  switchAdults?: number; //   host willing to be a guest
  switchChildren?: number;
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const token = bearerToken(event.headers?.authorization ?? event.headers?.Authorization);
    if (!token) return unauthorized();
    const session = await verifySessionToken(token);

    const body = parseBody<RegisterBody>(event.body);

    if (body.role !== "host" && body.role !== "guest") {
      return badRequest("role must be 'host' or 'guest'.");
    }
    // Substitute the default location when the address didn't compute. Note
    // typeof NaN === "number", so we must check Number.isFinite, not typeof.
    const hasValidLocation =
      !!body.address &&
      Number.isFinite(body.lat) &&
      Number.isFinite(body.lng);
    const address = hasValidLocation ? body.address : DEFAULT_RESULT.formattedAddress;
    const lat = hasValidLocation ? body.lat : DEFAULT_RESULT.lat;
    const lng = hasValidLocation ? body.lng : DEFAULT_RESULT.lng;

    if (body.role === "host") {
      if (!body.targetCapacity || body.targetCapacity < 1) {
        return badRequest("Enter how many people you can comfortably host.");
      }
      // A host willing to be a guest must say their party size for that case.
      if (body.flexibleRole && (body.switchAdults ?? 0) + (body.switchChildren ?? 0) < 1) {
        return badRequest("Tell us your party size for if you switch to being a guest.");
      }
    } else {
      const adults = body.adults ?? 0;
      const children = body.children ?? 0;
      if (adults + children < 1) {
        return badRequest("Enter at least one adult or child in your party.");
      }
      // A guest willing to host must say how many they could seat.
      if (body.flexibleRole && (!body.switchCapacity || body.switchCapacity < 1)) {
        return badRequest("Tell us how many you could seat if you switch to hosting.");
      }
    }

    const now = new Date().toISOString();

    const updated = await updateJson<RegistrationsFile>(
      REGISTRATIONS_KEY,
      { registrations: [] },
      (current) => {
        const existingIndex = current.registrations.findIndex(
          (r) => r.email === session.sub
        );
        const flexibleRole = body.flexibleRole ?? false;
        const base = {
          id: existingIndex >= 0 ? current.registrations[existingIndex].id : randomId(),
          email: session.sub,
          fullName: session.fullName,
          address,
          lat,
          lng,
          notes: body.notes,
          flexibleRole,
          // Only keep the opposite-role details when the switch is offered.
          switchCapacity: flexibleRole ? body.switchCapacity : undefined,
          switchFlex: flexibleRole ? body.switchFlex : undefined,
          switchAdults: flexibleRole ? body.switchAdults : undefined,
          switchChildren: flexibleRole ? body.switchChildren : undefined,
          createdAt:
            existingIndex >= 0
              ? current.registrations[existingIndex].createdAt
              : now,
          updatedAt: now,
        };

        const record: Registration =
          body.role === "host"
            ? {
                ...base,
                role: "host",
                targetCapacity: body.targetCapacity!,
                flex: body.flex ?? 2,
              }
            : {
                ...base,
                role: "guest",
                adults: body.adults ?? 0,
                children: body.children ?? 0,
              };

        const next = [...current.registrations];
        if (existingIndex >= 0) {
          next[existingIndex] = record;
        } else {
          next.push(record);
        }
        return { registrations: next };
      }
    );

    const saved = updated.registrations.find((r) => r.email === session.sub);
    return ok({ registration: saved });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
