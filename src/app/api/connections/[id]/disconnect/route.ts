import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.connection.delete({
    where: { id }
  });

  return NextResponse.redirect(new URL("/connections", env.APP_BASE_URL()));
}
