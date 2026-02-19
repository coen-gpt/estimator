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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error(`Failed to read ${file.name}.`));
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
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
        photos.slice(0, 3).map(async (photo): Promise<SerializablePhoto> => ({
          name: photo.name,
          size: photo.size,
          type: photo.type,
          dataUrl: await fileToDataUrl(photo)
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

      const data = (await response.json()) as {
        ok: boolean;
        assistantMessage?: string;
        roughEstimate?: AgentResult["roughEstimate"];
        rendering?: AgentResult["rendering"];
        error?: string;
      };

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
            <small>{selectedPhotoText}</small>
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
