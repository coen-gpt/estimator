import { NextResponse } from "next/server";
import { createOAuthStateToken } from "@/lib/oauth-state";
import { env } from "@/lib/env";
import { JOBBER_AUTHORIZE_URL } from "@/lib/jobber";

export const runtime = "nodejs";

export async function GET() {
  const state = createOAuthStateToken();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.JOBBER_CLIENT_ID(),
    redirect_uri: env.JOBBER_REDIRECT_URI(),
    state
  });

  const authorizeUrl = `${JOBBER_AUTHORIZE_URL}?${params.toString()}`;
  return NextResponse.redirect(authorizeUrl);
}
