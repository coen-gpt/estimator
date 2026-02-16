import Link from "next/link";

export default function HomePage() {
  return (
    <section className="card">
      <h1>CoenGPT + Jobber Integration</h1>
      <p>Connect Jobber via OAuth, manage tokens, and use AI agent endpoints for draft quotes.</p>
      <p>
        <Link className="button" href="/jobber/connect">
          Connect Jobber
        </Link>
      </p>
      <p>
        <Link href="/connections">Go to connections</Link>
      </p>
    </section>
  );
}
