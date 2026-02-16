import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/token";
import { jobberGraphQL } from "@/lib/jobber";

export const runtime = "nodejs";

const TEST_QUERY = /* GraphQL */ `
  query CoenGPTTestQuery {
    viewer {
      id
      email
      name
    }
  }
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");

  if (!connectionId) {
    return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(connectionId);
    const result = await jobberGraphQL<Record<string, unknown>, Record<string, unknown>>(
      accessToken,
      TEST_QUERY,
      {}
    );

    if (result.errors?.length) {
      return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
