import Link from "next/link";
import EstimatorAgentWidget from "@/components/EstimatorAgentWidget";

export default function HomePage() {
  return (
    <>
      <section className="card">
        <h1>Residential AI Estimator + Project Designer</h1>
        <p>
          Give customers a sleek chat experience where they can describe their project, upload photos, and get a
          concept drawing/rendering that prioritizes uploaded house photos (or Google Street View from address fallback) with a rough, non-binding budget range.
        </p>
        <p>
          The tool sets expectations clearly: better details + more photos = better design guidance and better
          early estimate quality, before your human estimator performs the on-site visit.
        </p>
        <p>
          <Link className="button" href="/jobber/connect">
            Connect Jobber
          </Link>
        </p>
        <p>
          <Link href="/connections">Go to connections</Link>
        </p>
      </section>

      <EstimatorAgentWidget />
    </>
  );
}
