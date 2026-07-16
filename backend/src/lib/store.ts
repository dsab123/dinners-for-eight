import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  NoSuchKey,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({});
const BUCKET = process.env.DATA_BUCKET_NAME!;

async function streamToString(body: any): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Reads a JSON file from the data bucket, returning `fallback` if it
 * doesn't exist yet. Also returns the S3 ETag so callers can do an
 * optimistic-lock write (safe enough at this app's scale).
 */
export async function readJson<T>(
  key: string,
  fallback: T
): Promise<{ data: T; etag?: string }> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const text = await streamToString(res.Body);
    return { data: JSON.parse(text) as T, etag: res.ETag };
  } catch (err) {
    if (err instanceof NoSuchKey || (err as any)?.name === "NoSuchKey") {
      return { data: fallback, etag: undefined };
    }
    throw err;
  }
}

export async function writeJson<T>(key: string, data: T): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}

/**
 * Read-modify-write with a small retry loop. Not a real transaction, but
 * at "a few dozen households sign up before Sunday" scale, collisions are
 * rare and a retry is enough.
 */
export async function updateJson<T>(
  key: string,
  fallback: T,
  mutate: (current: T) => T,
  attempts = 3
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await readJson<T>(key, fallback);
    const next = mutate(data);
    await writeJson(key, next);
    return next;
  }
  throw new Error("updateJson: exhausted retries");
}

export const REGISTRATIONS_KEY = "data/registrations.json";
export const MATCHES_KEY = "data/matches.json";
