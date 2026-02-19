import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type UploadedPhoto = {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
};

type EstimatorRequest = {
  messages: ChatMessage[];
  projectAddress?: string;
  timeline?: string;
  photos?: UploadedPhoto[];
};

type EstimateLine = {
  label: string;
  amount: number;
};

const PROJECT_BASE_COSTS: Record<string, number> = {
  kitchen: 32000,
  bathroom: 18000,
  basement: 42000,
  addition: 78000,
  roofing: 16000,
  deck: 14000,
  exterior: 22000,
  general: 25000
};

function parseBody(body: unknown): EstimatorRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Body must be a JSON object.");
  }

  const input = body as Partial<EstimatorRequest>;
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new Error("messages must be a non-empty array.");
  }

  return {
    messages: input.messages,
    projectAddress: input.projectAddress,
    timeline: input.timeline,
    photos: input.photos ?? []
  };
}

function identifyProjectType(text: string): keyof typeof PROJECT_BASE_COSTS {
  const lower = text.toLowerCase();
  if (lower.includes("kitchen")) return "kitchen";
  if (lower.includes("bath")) return "bathroom";
  if (lower.includes("basement")) return "basement";
  if (lower.includes("addition") || lower.includes("add-on")) return "addition";
  if (lower.includes("roof")) return "roofing";
  if (lower.includes("deck") || lower.includes("patio")) return "deck";
  if (lower.includes("exterior") || lower.includes("siding") || lower.includes("paint")) {
    return "exterior";
  }
  return "general";
}

function extractSqft(text: string): number | null {
  const match = text.match(/(\d{2,5})\s?(sq\.?\s?ft|square\s?feet|sf)/i);
  if (!match) return null;
  return Number(match[1]);
}

function buildMockupSvg(type: string): string {
  const title = `Concept Mock-up: ${type[0].toUpperCase()}${type.slice(1)} Project`;
  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#e7f7f3' />
        <stop offset='100%' stop-color='#dbeafe' />
      </linearGradient>
    </defs>
    <rect width='640' height='360' fill='url(#bg)' />
    <rect x='110' y='130' width='420' height='170' rx='10' fill='#f8fafc' stroke='#0f766e' stroke-width='4' />
    <polygon points='90,140 320,45 550,140' fill='#134e4a' />
    <rect x='280' y='190' width='90' height='110' fill='#115e59' />
    <rect x='150' y='170' width='95' height='65' fill='#bfdbfe' stroke='#1d4ed8' stroke-width='3' />
    <rect x='395' y='170' width='95' height='65' fill='#bfdbfe' stroke='#1d4ed8' stroke-width='3' />
    <text x='320' y='330' text-anchor='middle' font-family='Segoe UI, sans-serif' font-size='24' fill='#0f172a'>${title}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function buildGoogleStreetViewUrl(address: string): string | null {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return null;
  }

  const params = new URLSearchParams({
    size: "1280x720",
    location: address,
    fov: "90",
    pitch: "0",
    key: apiKey
  });

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

function pickRenderingSource(body: EstimatorRequest, projectType: string): { imageUrl: string; source: string } {
  const firstUploadedPhoto = body.photos?.find((photo) => typeof photo.dataUrl === "string" && photo.dataUrl.startsWith("data:image/"));
  if (firstUploadedPhoto?.dataUrl) {
    return {
      imageUrl: firstUploadedPhoto.dataUrl,
      source: "customer_upload"
    };
  }

  if (body.projectAddress) {
    const googleStreetViewUrl = buildGoogleStreetViewUrl(body.projectAddress);
    if (googleStreetViewUrl) {
      return {
        imageUrl: googleStreetViewUrl,
        source: "google_street_view"
      };
    }
  }

  return {
    imageUrl: buildMockupSvg(projectType),
    source: "fallback_mockup"
  };
}

function buildEstimate(text: string): { type: string; lines: EstimateLine[]; low: number; high: number } {
  const type = identifyProjectType(text);
  const sqft = extractSqft(text);
  const base = PROJECT_BASE_COSTS[type];

  const scaleFactor = sqft ? Math.max(0.75, Math.min(2.5, sqft / 900)) : 1;
  const finishFactor = /luxury|premium|high-end/i.test(text) ? 1.3 : /budget|basic/i.test(text) ? 0.85 : 1;
  const complexityFactor = /structural|custom|permit|electrical|plumbing/i.test(text) ? 1.2 : 1;

  const subtotal = Math.round(base * scaleFactor * finishFactor * complexityFactor);
  const lines: EstimateLine[] = [
    { label: "Materials", amount: Math.round(subtotal * 0.45) },
    { label: "Labor", amount: Math.round(subtotal * 0.4) },
    { label: "Permits & Compliance", amount: Math.round(subtotal * 0.07) },
    { label: "Contingency", amount: Math.round(subtotal * 0.08) }
  ];

  return {
    type,
    lines,
    low: Math.round(subtotal * 0.9),
    high: Math.round(subtotal * 1.15)
  };
}

export async function POST(req: Request) {
  try {
    const body = parseBody(await req.json());
    const transcript = body.messages.map((entry) => entry.content).join("\n");
    const estimate = buildEstimate(transcript);
    const photoCount = body.photos?.length ?? 0;
    const rendering = pickRenderingSource(body, estimate.type);

    const sourceMessage =
      rendering.source === "customer_upload"
        ? "I used your uploaded house photo as the rendering base so the concept is grounded in your real conditions."
        : rendering.source === "google_street_view"
          ? "I used a Google Street View photo from your project address as the rendering base because no upload was provided."
          : "I could not access a house photo, so I generated a generic concept placeholder. Add a photo or provide a Google Maps API key for address-based imagery.";

    const assistantMessage = [
      `Great start! I reviewed your ${estimate.type} project details${photoCount ? ` and ${photoCount} uploaded photo(s)` : ""}.`,
      "I can act as your personal project designer by turning your scope into concept drawings/renderings and early budget guidance.",
      sourceMessage,
      "Tip: the more measurements, finish preferences, must-haves, and progress photos you share, the more useful and accurate your concept + range will be.",
      `Based on what you provided, your preliminary planning range is **$${estimate.low.toLocaleString()} - $${estimate.high.toLocaleString()}**.`,
      "This is a planning estimate only (not a formal proposal). A licensed human estimator must confirm site conditions, measurements, and code requirements on-site."
    ].join(" ");

    return NextResponse.json({
      ok: true,
      assistantMessage,
      roughEstimate: {
        projectType: estimate.type,
        low: estimate.low,
        high: estimate.high,
        lineItems: estimate.lines
      },
      rendering: {
        title: `${estimate.type[0].toUpperCase()}${estimate.type.slice(1)} concept rendering`,
        imageUrl: rendering.imageUrl,
        source: rendering.source
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process estimator request.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
