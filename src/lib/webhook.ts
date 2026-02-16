import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export async function getRawBody(req: Request): Promise<Buffer> {
  const arrayBuffer = await req.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function computeWebhookSignature(rawBody: Buffer): string {
  return createHmac("sha256", env.JOBBER_CLIENT_SECRET()).update(rawBody).digest("base64");
}

export function verifyWebhookSignature(rawBody: Buffer, providedSignature: string | null): boolean {
  if (!providedSignature) return false;

  const expected = computeWebhookSignature(rawBody);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(providedSignature);

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, providedBuf);
}

export function payloadSha256(rawBody: Buffer): string {
  return createHash("sha256").update(rawBody).digest("hex");
}
