import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { JOBBER_TOKEN_URL } from "@/lib/jobber";
import { verifyOAuthStateToken } from "@/lib/oauth-state";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type OAuthTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

function errorHtml(message: string, status = 400): Response {
  return new Response(
    `<!doctype html><html><body style="font-family:sans-serif;padding:24px"><h1>OAuth Error</h1><p>${message}</p><p><a href="/">Back home</a></p></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    }
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return errorHtml("Missing required query params: code and state.", 400);
  }

  try {
    verifyOAuthStateToken(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid OAuth state";
    return errorHtml(message, 401);
  }

  const tokenRes = await fetch(JOBBER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: env.JOBBER_CLIENT_ID(),
      client_secret: env.JOBBER_CLIENT_SECRET(),
      code,
      redirect_uri: env.JOBBER_REDIRECT_URI()
    }),
    cache: "no-store"
  });

  const tokenBody = (await tokenRes.json()) as OAuthTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenBody.access_token || !tokenBody.refresh_token) {
    return errorHtml(
      `Token exchange failed: ${tokenBody.error_description || tokenBody.error || tokenRes.statusText}`,
      400
    );
  }

  const expiresAt = new Date(Date.now() + tokenBody.expires_in * 1000);
  const scopes = tokenBody.scope ? tokenBody.scope.split(" ").filter(Boolean) : [];

  // TODO: Use Jobber account/user identifiers to upsert by external account instead of creating a new record.
  await prisma.connection.create({
    data: {
      provider: "jobber",
      token: {
        create: {
          accessToken: tokenBody.access_token,
          refreshToken: tokenBody.refresh_token,
          expiresAt,
          scopes
        }
      },
      lastRefreshedAt: new Date()
    }
  });

  const redirectUrl = new URL("/connections", env.APP_BASE_URL());
  return NextResponse.redirect(redirectUrl);
}
