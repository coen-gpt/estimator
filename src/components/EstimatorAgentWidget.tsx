"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type EstimateLine = {
  label: string;
  amount: number;
};

type AgentResult = {
  roughEstimate: {
    projectType: string;
    low: number;
    high: number;
    lineItems: EstimateLine[];
  };
  rendering: {
    title: string;
    imageUrl: string;
    source: "customer_upload" | "google_street_view" | "fallback_mockup";
  };
};

type SerializablePhoto = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const MAX_RENDERING_PHOTOS = 2;
const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.72;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error(`Failed to load ${file.name}.`));
    };
    img.src = blobUrl;
  });
}

async function fileToOptimizedDataUrl(file: File): Promise<string> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not process image for upload.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

async function parseApiResponse(response: Response): Promise<{
  ok: boolean;
  assistantMessage?: string;
  roughEstimate?: AgentResult["roughEstimate"];
  rendering?: AgentResult["rendering"];
  error?: string;
}> {
  const rawBody = await response.text();
  try {
    return JSON.parse(rawBody) as {
      ok: boolean;
      assistantMessage?: string;
      roughEstimate?: AgentResult["roughEstimate"];
      rendering?: AgentResult["rendering"];
      error?: string;
    };
  } catch {
    return {
      ok: false,
      error:
        "The server returned a non-JSON response. This usually means the request was too large (try fewer/smaller photos) or the server errored before JSON handling."
    };
  }
}

export default function EstimatorAgentWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [timeline, setTimeline] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome! I am your Personal Project Designer + Estimator. Share your room size, materials, goals, must-haves, and photos so I can create a stronger concept rendering and a more accurate rough budget range."
    }
  ]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentResult | null>(null);

  const selectedPhotoText = useMemo(() => {
    if (!photos.length) return "No photos uploaded yet";
    return `${photos.length} photo${photos.length > 1 ? "s" : ""} uploaded — great, this improves concept quality.`;
  }, [photos]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;

    const nextMessages = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages(nextMessages);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const photosWithData = await Promise.all(
        photos.slice(0, MAX_RENDERING_PHOTOS).map(async (photo): Promise<SerializablePhoto> => ({
          name: photo.name,
          size: photo.size,
          type: photo.type,
          dataUrl: await fileToOptimizedDataUrl(photo)
        }))
      );

      const response = await fetch("/api/agent/residential/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          timeline,
          projectAddress,
          photos: photosWithData
        })
      });

      const data = await parseApiResponse(response);

      if (!response.ok || !data.ok || !data.assistantMessage || !data.roughEstimate || !data.rendering) {
        throw new Error(data.error ?? "The estimator agent could not generate a response.");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.assistantMessage ?? "" }]);
      setResult({ roughEstimate: data.roughEstimate, rendering: data.rendering });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="estimator-trigger" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? "Close Designer Chat" : "Open AI Project Designer"}
      </button>

      {open ? (
        <aside className="estimator-widget" aria-label="Residential construction estimator">
          <header className="estimator-header">
            <p className="eyebrow">AI ESTIMATOR + DESIGNER</p>
            <h2>Your Personal Project Designer</h2>
            <p>
              The more details and photos you share, the better your rendering concept and preliminary budget
              guidance will be.
            </p>
          </header>

          <div className="estimator-messages">
            {messages.map((message, index) => (
              <p className={`bubble ${message.role}`} key={`${message.role}-${index}`}>
                {message.content}
              </p>
            ))}
            {pending ? <p className="bubble assistant">Designing your concept and drafting your rough estimate...</p> : null}
          </div>

          <form onSubmit={onSubmit} className="estimator-form">
            <label>
              Project address (optional)
              <input value={projectAddress} onChange={(event) => setProjectAddress(event.target.value)} />
            </label>
            <label>
              Desired timeline (optional)
              <input value={timeline} onChange={(event) => setTimeline(event.target.value)} />
            </label>
            <label>
              Upload inspiration or current-condition photos
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setPhotos(Array.from(event.target.files ?? []))}
              />
            </label>
            <small>{selectedPhotoText} (we automatically optimize uploads before sending)</small>
            <label>
              Project details
              <textarea
                required
                rows={4}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Example: 320 sq ft kitchen remodel, island, white oak cabinets, quartz counters, statement lighting, and hidden pantry."
              />
            </label>
            <button className="button" disabled={pending} type="submit">
              {pending ? "Generating..." : "Create concept + rough estimate"}
            </button>
            {error ? <p className="error-text">{error}</p> : null}
          </form>

          {result ? (
            <section className="estimator-result card">
              <h3>Design concept rendering</h3>
              <p className="rendering-source">
                Source:{" "}
                {result.rendering.source === "customer_upload"
                  ? "Uploaded customer photo"
                  : result.rendering.source === "google_street_view"
                    ? "Google Street View (address-based fallback)"
                    : "Fallback mock-up"}
              </p>
              <Image src={result.rendering.imageUrl} alt={result.rendering.title} width={640} height={360} unoptimized />
              <h3>Rough estimate ({result.roughEstimate.projectType})</h3>
              <p className="estimate-range">
                {currency.format(result.roughEstimate.low)} - {currency.format(result.roughEstimate.high)}
              </p>
              <ul>
                {result.roughEstimate.lineItems.map((item) => (
                  <li key={item.label}>
                    {item.label}: {currency.format(item.amount)}
                  </li>
                ))}
              </ul>
              <p className="disclaimer">
                Informational only — this is not an official proposal. Final pricing requires an on-site visit by
                a human estimator.
              </p>
            </section>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
