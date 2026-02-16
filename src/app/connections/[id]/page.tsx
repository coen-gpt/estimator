import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConnectionDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const connection = await prisma.connection.findUnique({
    where: { id },
    include: {
      token: true,
      webhookEvents: {
        orderBy: { receivedAt: "desc" },
        take: 20
      }
    }
  });

  if (!connection) {
    notFound();
  }

  return (
    <section className="card">
      <h1>Connection {connection.id}</h1>
      <p>
        <Link href="/connections">Back to all connections</Link>
      </p>

      <div className="card">
        <h2>Token</h2>
        <p>
          Expires: <span className="code">{connection.token?.expiresAt.toISOString() ?? "n/a"}</span>
        </p>
        <p>
          Scopes: <span className="code">{connection.token?.scopes.join(", ") || "none"}</span>
        </p>
        <form action={`/api/connections/${connection.id}/refresh`} method="post">
          <button className="button" type="submit">
            Refresh token now
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Webhook Testing</h2>
        <p>
          Send a signed POST request to <span className="code">/webhooks/jobber</span> with header
          <span className="code"> X-Jobber-Hmac-SHA256</span> using the Jobber client secret as HMAC key.
        </p>
      </div>

      <div className="card">
        <h2>Latest Webhook Events</h2>
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Topic</th>
              <th>External ID</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {connection.webhookEvents.map((event) => (
              <tr key={event.id}>
                <td>{event.receivedAt.toISOString()}</td>
                <td>{event.topic ?? "-"}</td>
                <td>{event.externalId ?? "-"}</td>
                <td>
                  <span className="code">{event.payloadHash.slice(0, 18)}...</span>
                </td>
              </tr>
            ))}
            {connection.webhookEvents.length === 0 ? (
              <tr>
                <td colSpan={4}>No webhook events yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
