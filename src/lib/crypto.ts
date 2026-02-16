import { createHmac, timingSafeEqual } from "node:crypto";

export function base64UrlEncode(input: string | Buffer): string {
  const base64 = Buffer.from(input).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = 4 - (normalized.length % 4 || 4);
  const padded = normalized + "=".repeat(padding % 4);
  return Buffer.from(padded, "base64");
}

export function signHmacSha256(data: string, secret: string): string {
  return base64UrlEncode(createHmac("sha256", secret).update(data).digest());
}

export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) return false;

  return timingSafeEqual(aBuf, bBuf);
}
