import type { APIGatewayProxyResultV2 } from "aws-lambda";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export function json(
  statusCode: number,
  body: unknown
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

export function ok(body: unknown) {
  return json(200, body);
}

export function badRequest(message: string) {
  return json(400, { error: message });
}

export function unauthorized(message = "Unauthorized") {
  return json(401, { error: message });
}

export function forbidden(message = "Forbidden") {
  return json(403, { error: message });
}

export function notFound(message = "Not found") {
  return json(404, { error: message });
}

export function serverError(message = "Something went wrong") {
  return json(500, { error: message });
}

export function preflight(): APIGatewayProxyResultV2 {
  return { statusCode: 204, headers: CORS_HEADERS, body: "" };
}

export function parseBody<T>(body: string | undefined | null): T {
  if (!body) throw new Error("Missing request body");
  return JSON.parse(body) as T;
}
