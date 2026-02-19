import Link from "next/link";
import EstimatorAgentWidget from "@/components/EstimatorAgentWidget";

const services = [
  {
    title: "Whole Home Renovations",
    description: "Luxury remodeling with planning, permitting, and craftsmanship managed end-to-end."
  },
  {
    title: "Kitchen & Bath Transformations",
    description: "Design-forward updates that balance timeless style, functionality, and resale value."
  },
  {
    title: "Additions & Exterior Upgrades",
    description: "Custom expansions, siding, roofing, and outdoor living spaces tailored to your home."
  }
];

export default function HomePage() {
  return (
    <>
      <section className="coen-hero">
        <div className="coen-overlay" />
        <header className="coen-nav">
          <p className="coen-brand">COEN CONSTRUCTION</p>
          <nav>
            <a href="#services">Services</a>
            <a href="#process">Process</a>
            <a href="#contact">Contact</a>
          </nav>
        </header>

        <div className="coen-hero-content">
          <p className="coen-kicker">RESIDENTIAL CONSTRUCTION & REMODELING</p>
          <h1>Built to Last. Designed Around Your Life.</h1>
          <p>
            Premium residential construction with transparent communication, dependable timelines, and a detail-first
            team from concept to completion.
          </p>
          <div className="coen-hero-actions">
            <a className="button" href="#contact">
              Book a Consultation
            </a>
            <Link className="button secondary" href="/jobber/connect">
              Connect Jobber
            </Link>
          </div>
        </div>
      </section>

      <section id="services" className="coen-section">
        <div className="coen-section-header">
          <p className="coen-kicker">OUR SERVICES</p>
          <h2>Residential Expertise with Professional Project Delivery</h2>
        </div>
        <div className="coen-grid">
          {services.map((service) => (
            <article key={service.title} className="coen-service-card">
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="process" className="coen-section coen-process">
        <div>
          <p className="coen-kicker">HOW WE WORK</p>
          <h2>Design, Build, and Deliver with Confidence</h2>
          <p>
            Our team combines practical construction insight with client-first planning so your project stays aligned on
            quality, scope, and budget.
          </p>
        </div>
        <ol>
          <li>
            <strong>Discovery</strong>
            <span>We capture your goals, constraints, and vision in detail.</span>
          </li>
          <li>
            <strong>Design & Estimate</strong>
            <span>We refine scope and budget assumptions before construction begins.</span>
          </li>
          <li>
            <strong>Build Execution</strong>
            <span>Licensed trades and project management deliver the final result.</span>
          </li>
        </ol>
      </section>

      <section id="contact" className="coen-section card coen-contact">
        <h2>Start Your Project</h2>
        <p>
          Use our AI Project Designer chat to share your details and photos for a concept rendering + planning range,
          then our human estimator confirms final site-based pricing.
        </p>
        <p>
          <Link href="/connections">Go to connections</Link>
        </p>
      </section>

      <EstimatorAgentWidget />
    </>
  );
}
