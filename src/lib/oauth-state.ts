import { base64UrlDecode, base64UrlEncode, safeEqual, signHmacSha256 } from "@/lib/crypto";
import { env } from "@/lib/env";

type OAuthStatePayload = {
  exp: number;
  iat: number;
  nonce: string;
};

const STATE_TTL_SECONDS = 60 * 10;

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return base64UrlEncode(Buffer.from(bytes));
}

export function createOAuthStateToken(): string {
  const iat = Math.floor(Date.now() / 1000);
  const payload: OAuthStatePayload = {
    iat,
    exp: iat + STATE_TTL_SECONDS,
    nonce: randomNonce()
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signHmacSha256(encodedPayload, env.OAUTH_STATE_SECRET());

  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthStateToken(token: string): OAuthStatePayload {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    throw new Error("Malformed state token");
  }

  const expectedSignature = signHmacSha256(encodedPayload, env.OAUTH_STATE_SECRET());
  if (!safeEqual(signature, expectedSignature)) {
    throw new Error("Invalid state signature");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as OAuthStatePayload;
  if (!payload.exp || !payload.iat || !payload.nonce) {
    throw new Error("Malformed state payload");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error("State token expired");
  }

  return payload;
}
