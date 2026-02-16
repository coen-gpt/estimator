import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRawBody, payloadSha256, verifyWebhookSignature } from "@/lib/webhook";

export const runtime = "nodejs";

function maybeConnectionIdFromPayload(payload: Record<string, unknown>): string | undefined {
  // TODO: Map Jobber account identifier in webhook payload to local Connection.id.
  const candidate = payload.connectionId;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }
  return undefined;
}

export async function POST(req: Request) {
  const rawBody = await getRawBody(req);
  const signature = req.headers.get("X-Jobber-Hmac-SHA256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const payloadText = rawBody.toString("utf8");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadText) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const externalId =
    typeof payload.id === "string"
      ? payload.id
      : typeof payload.eventId === "string"
        ? payload.eventId
        : null;

  const hash = payloadSha256(rawBody);
  const topic = typeof payload.topic === "string" ? payload.topic : null;
  const connectionId = maybeConnectionIdFromPayload(payload);

  try {
    const event = await prisma.webhookEvent.create({
      data: {
        externalId,
        payloadHash: hash,
        topic,
        connectionId,
        rawPayload: payload
      }
    });

    await prisma.job.create({
      data: {
        webhookEventId: event.id,
        status: "PENDING"
      }
    });

    console.info("jobber_webhook_received", {
      eventId: event.id,
      topic,
      hasExternalId: Boolean(externalId)
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: true, deduped: true });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("jobber_webhook_error", { message });
    return NextResponse.json({ error: "Webhook persistence failed" }, { status: 500 });
  }

  // Return quickly. Long-running processing should happen in async workers.
  return NextResponse.json({ ok: true });
}
