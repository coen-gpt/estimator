import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { JOBBER_TOKEN_URL } from "@/lib/jobber";

const REFRESH_WINDOW_MS = 2 * 60 * 1000;

type TokenRefreshResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

function shouldRefresh(expiresAt: Date): boolean {
  const now = Date.now();
  return expiresAt.getTime() - now <= REFRESH_WINDOW_MS;
}

export async function getValidAccessToken(connectionId: string): Promise<string> {
  const tokenRecord = await prisma.token.findUnique({
    where: { connectionId }
  });

  if (!tokenRecord) {
    throw new Error(`No token found for connection ${connectionId}`);
  }

  if (!shouldRefresh(tokenRecord.expiresAt)) {
    return tokenRecord.accessToken;
  }

  const refreshed = await refreshAccessToken(connectionId, tokenRecord.refreshToken);
  return refreshed.accessToken;
}

export async function refreshAccessToken(connectionId: string, refreshToken: string) {
  const existing = await prisma.token.findUnique({
    where: { connectionId }
  });
  if (!existing) {
    throw new Error(`No token found for connection ${connectionId}`);
  }

  const response = await fetch(JOBBER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: env.JOBBER_CLIENT_ID(),
      client_secret: env.JOBBER_CLIENT_SECRET(),
      refresh_token: refreshToken
    }),
    cache: "no-store"
  });

  const body = (await response.json()) as TokenRefreshResponse & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_description || body.error || `Token refresh failed with status ${response.status}`
    );
  }

  const expiresAt = new Date(Date.now() + body.expires_in * 1000);
  const scopes = body.scope ? body.scope.split(" ").filter(Boolean) : existing.scopes;

  const updatedToken = await prisma.token.update({
    where: { connectionId },
    data: {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? refreshToken,
      expiresAt,
      scopes
    }
  });

  await prisma.connection.update({
    where: { id: connectionId },
    data: {
      lastRefreshedAt: new Date()
    }
  });

  return updatedToken;
}
