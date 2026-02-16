import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTokenValid(expiresAt: Date): boolean {
  return expiresAt.getTime() > Date.now();
}

export default async function ConnectionsPage() {
  const connections = await prisma.connection.findMany({
    include: { token: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <section className="card">
      <h1>Jobber Connections</h1>
      <p>
        <Link href="/">Home</Link>
      </p>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Created</th>
            <th>Last Refreshed</th>
            <th>Scopes</th>
            <th>Token Valid</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {connections.map((connection) => (
            <tr key={connection.id}>
              <td>
                <Link href={`/connections/${connection.id}`}>{connection.id}</Link>
              </td>
              <td>{connection.createdAt.toISOString()}</td>
              <td>{connection.lastRefreshedAt?.toISOString() ?? "never"}</td>
              <td>{connection.token?.scopes.join(", ") || "none"}</td>
              <td>{connection.token ? (isTokenValid(connection.token.expiresAt) ? "yes" : "no") : "no"}</td>
              <td>
                <a
                  className="button secondary"
                  href={`/api/jobber/test?connectionId=${connection.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Test GraphQL
                </a>{" "}
                <form
                  action={`/api/connections/${connection.id}/disconnect`}
                  method="post"
                  style={{ display: "inline-block", marginLeft: 8 }}
                >
                  <button className="button danger" type="submit">
                    Disconnect
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {connections.length === 0 ? (
            <tr>
              <td colSpan={6}>No connections yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
