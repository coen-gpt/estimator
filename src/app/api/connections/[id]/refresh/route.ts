import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { refreshAccessToken } from "@/lib/token";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const token = await prisma.token.findUnique({ where: { connectionId: id } });
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  try {
    await refreshAccessToken(id, token.refreshToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/connections/${id}`, env.APP_BASE_URL()));
}
