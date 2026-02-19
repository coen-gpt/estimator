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

type AiEstimatePayload = {
  assistantSummary: string;
  projectType: string;
  lowEstimate: number;
  highEstimate: number;
  lineItems: EstimateLine[];
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

function buildHeuristicEstimate(text: string): { type: string; lines: EstimateLine[]; low: number; high: number } {
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

async function generateAiEstimate(body: EstimatorRequest, transcript: string): Promise<AiEstimatePayload | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const photoSummary = (body.photos ?? []).map((photo) => `${photo.name} (${photo.type}, ${photo.size} bytes)`).join(", ");

  const systemPrompt = [
    "You are an experienced residential construction estimator and project designer assistant.",
    "Return STRICT JSON only with keys: assistantSummary, projectType, lowEstimate, highEstimate, lineItems.",
    "lineItems must be an array of {label, amount} where amount is integer USD.",
    "Keep the estimate non-binding and realistic for early planning, with a reasonable range.",
    "assistantSummary should be concise (2-4 sentences), practical, and mention this is not a final proposal."
  ].join(" ");

  const userPrompt = {
    messages: body.messages,
    projectAddress: body.projectAddress ?? "",
    timeline: body.timeline ?? "",
    uploadedPhotoCount: body.photos?.length ?? 0,
    uploadedPhotoSummary: photoSummary,
    transcript
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPrompt) }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content) as Partial<AiEstimatePayload>;
  if (
    typeof parsed.assistantSummary !== "string" ||
    typeof parsed.projectType !== "string" ||
    typeof parsed.lowEstimate !== "number" ||
    typeof parsed.highEstimate !== "number" ||
    !Array.isArray(parsed.lineItems)
  ) {
    return null;
  }

  const lineItems = parsed.lineItems
    .filter((item): item is EstimateLine => {
      if (!item || typeof item !== "object") return false;
      const value = item as Partial<EstimateLine>;
      return typeof value.label === "string" && typeof value.amount === "number";
    })
    .map((item) => ({ label: item.label, amount: Math.round(item.amount) }));

  return {
    assistantSummary: parsed.assistantSummary,
    projectType: parsed.projectType,
    lowEstimate: Math.round(parsed.lowEstimate),
    highEstimate: Math.round(parsed.highEstimate),
    lineItems
  };
}

export async function POST(req: Request) {
  try {
    const body = parseBody(await req.json());
    const transcript = body.messages.map((entry) => entry.content).join("\n");
    const fallbackEstimate = buildHeuristicEstimate(transcript);
    const rendering = pickRenderingSource(body, fallbackEstimate.type);
    const photoCount = body.photos?.length ?? 0;

    const aiEstimate = await generateAiEstimate(body, transcript);

    const projectType = aiEstimate?.projectType ?? fallbackEstimate.type;
    const low = aiEstimate?.lowEstimate ?? fallbackEstimate.low;
    const high = aiEstimate?.highEstimate ?? fallbackEstimate.high;
    const lineItems = aiEstimate?.lineItems.length ? aiEstimate.lineItems : fallbackEstimate.lines;

    const sourceMessage =
      rendering.source === "customer_upload"
        ? "I used your uploaded house photo as the rendering base so the concept is grounded in your real conditions."
        : rendering.source === "google_street_view"
          ? "I used a Google Street View photo from your project address as the rendering base because no upload was provided."
          : "I could not access a house photo, so I generated a generic concept placeholder. Add a photo or provide a Google Maps API key for address-based imagery.";

    const assistantMessage = aiEstimate?.assistantSummary
      ? `${aiEstimate.assistantSummary} ${sourceMessage}`
      : [
          `Great start! I reviewed your ${projectType} project details${photoCount ? ` and ${photoCount} uploaded photo(s)` : ""}.`,
          "I can act as your personal project designer by turning your scope into concept drawings/renderings and early budget guidance.",
          sourceMessage,
          "Tip: the more measurements, finish preferences, must-haves, and progress photos you share, the more useful and accurate your concept + range will be.",
          `Based on what you provided, your preliminary planning range is **$${low.toLocaleString()} - $${high.toLocaleString()}**.`,
          "This is a planning estimate only (not a formal proposal). A licensed human estimator must confirm site conditions, measurements, and code requirements on-site."
        ].join(" ");

    return NextResponse.json({
      ok: true,
      assistantMessage,
      roughEstimate: {
        projectType,
        low,
        high,
        lineItems
      },
      rendering: {
        title: `${projectType[0].toUpperCase()}${projectType.slice(1)} concept rendering`,
        imageUrl: rendering.imageUrl,
        source: rendering.source
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process estimator request.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
