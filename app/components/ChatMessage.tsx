"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowSquareOutIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  CompassIcon,
  MapPinIcon,
  NavigationArrowIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import type { LayerFilter, MapCommand } from "@/lib/agent/types";

type Props = {
  message: UIMessage;
  onMapCommand: (cmd: MapCommand, toolCallId: string) => void;
};

type Tool = {
  toolName: string;
  toolCallId: string;
  state: string;
  output: unknown;
};

/** Extract tool-like part fields from any part shape. */
function getToolInfo(part: UIMessage["parts"][number]): Tool | null {
  // Dynamic tool parts: { type: "dynamic-tool", toolName, toolCallId, state, ... }
  const p = part as Record<string, unknown>;
  if (
    typeof p.toolCallId === "string" &&
    (p.type === "dynamic-tool" ||
      (typeof p.type === "string" && p.type.startsWith("tool-")))
  ) {
    return {
      toolName:
        (p.toolName as string) ??
        (typeof p.type === "string" ? p.type.replace(/^tool-/, "") : ""),
      toolCallId: p.toolCallId as string,
      state: (p.state as string) ?? "pending",
      output: p.output,
    };
  }
  return null;
}

export function ChatMessage({ message, onMapCommand }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end px-1 py-1.5">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-[13px] leading-relaxed text-accent-foreground shadow-sm">
          {message.parts.map((part, i) =>
            part.type === "text" ? (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            ) : null,
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-2 px-1 py-1.5">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
        <SparkleIcon size={12} weight="fill" />
      </div>
      <div className="prose-chat min-w-0 flex-1 space-y-2 text-[13px] leading-relaxed text-foreground">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return <MarkdownText key={i} text={part.text} />;
          }

          const tool = getToolInfo(part);
          if (tool) {
            return (
              <ToolBlock
                key={i}
                tool={tool}
                onMapCommand={onMapCommand}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-1 whitespace-pre-wrap leading-relaxed">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
              {children}
            </code>
          ),
          h1: ({ children }) => (
            <h3 className="mt-2 mb-1 text-[14px] font-semibold">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="mt-2 mb-1 text-[14px] font-semibold">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-1.5 mb-1 text-[13px] font-semibold">{children}</h4>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ── Tool rendering ─────────────────────────────────────────────────────────

function ToolBlock({
  tool,
  onMapCommand,
}: {
  tool: Tool;
  onMapCommand: (cmd: MapCommand, toolCallId: string) => void;
}) {
  const isComplete = tool.state === "output-available";
  const result = (tool.output ?? {}) as Record<string, unknown>;

  // Fire map commands from tool results (parent dedupes by toolCallId)
  if (isComplete && tool.output) {
    if (tool.toolName === "addMapLayer" && result.added) {
      onMapCommand(
        {
          action: "addLayer",
          categoryId: result.categoryId as string,
          options: (result.options as Record<string, string | boolean>) ?? {},
          filter: result.filter as LayerFilter | undefined,
        },
        tool.toolCallId,
      );
    }

    if (tool.toolName === "removeMapLayer" && result.removed) {
      const target = result.target as string;
      if (target === "all") {
        onMapCommand({ action: "removeAllLayers" }, tool.toolCallId);
      } else {
        onMapCommand(
          { action: "removeLayer", categoryId: target },
          tool.toolCallId,
        );
      }
    }

    if (tool.toolName === "flyToLocation" && result.center) {
      onMapCommand(
        {
          action: "flyTo",
          center: result.center as [number, number],
          zoom: result.zoom as number,
        },
        tool.toolCallId,
      );
    }

    if (tool.toolName === "searchEvents") {
      const events = (result.events as EventItem[] | undefined) ?? [];
      const markers = events
        .filter(
          (e): e is EventItem & { lat: number; lng: number } =>
            typeof (e as { lat?: unknown }).lat === "number" &&
            typeof (e as { lng?: unknown }).lng === "number",
        )
        .map((e, i) => ({
          id: `${tool.toolCallId}:${i}`,
          lat: e.lat,
          lng: e.lng,
          title: e.name,
          subtitle: [e.time, e.venue].filter(Boolean).join(" · "),
          description: e.description,
          url: e.url,
          category: e.category,
        }));
      if (markers.length > 0) {
        onMapCommand(
          {
            action: "showMarkers",
            markers,
            label: (result.query as string) ?? "Events",
            fit: true,
          },
          tool.toolCallId,
        );
      }
    }
  }

  // Special-case rendering for searchEvents results
  if (tool.toolName === "searchEvents" && isComplete) {
    return <EventList result={result} />;
  }

  // Special-case rendering for getDirections, render as a clickable button
  if (tool.toolName === "getDirections" && isComplete && result.url) {
    return <DirectionsButton result={result} />;
  }

  // Special-case rendering for planTrip, render the trip card
  if (tool.toolName === "planTrip" && isComplete && result.ok) {
    return (
      <TripCard
        result={result}
        onMapCommand={onMapCommand}
        toolCallId={tool.toolCallId}
      />
    );
  }

  return <ToolStatusCard tool={tool} isComplete={isComplete} result={result} />;
}

function ToolStatusCard({
  tool,
  isComplete,
  result,
}: {
  tool: Tool;
  isComplete: boolean;
  result: Record<string, unknown>;
}) {
  const label = TOOL_LABELS[tool.toolName] ?? tool.toolName;
  const detail = describeTool(tool.toolName, result, isComplete);

  return (
    <div
      className={[
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors",
        isComplete
          ? "border-border bg-card text-muted-foreground"
          : "border-accent/30 bg-accent/5 text-foreground",
      ].join(" ")}
    >
      {isComplete ? (
        <CheckCircleIcon
          size={13}
          weight="fill"
          className="shrink-0 text-success"
        />
      ) : (
        <CircleNotchIcon
          size={13}
          weight="bold"
          className="shrink-0 animate-spin text-accent"
        />
      )}
      <span className="font-medium">{label}</span>
      {detail && (
        <span className="ml-auto truncate text-[11px] text-muted-foreground">
          {detail}
        </span>
      )}
    </div>
  );
}

// ── Event card grid ────────────────────────────────────────────────────────

type EventItem = {
  name: string;
  description?: string;
  date?: string; // YYYY-MM-DD
  time?: string;
  venue?: string;
  neighborhood?: string;
  borough?: string;
  url?: string;
  category?: string;
  lat?: number;
  lng?: number;
};

function EventList({ result }: { result: Record<string, unknown> }) {
  const events = (result.events as EventItem[] | undefined) ?? [];
  const error = result.error as string | undefined;

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
        {error}
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
        No events found.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <CalendarBlankIcon size={11} weight="bold" />
        <span>{events.length} events found</span>
      </div>
      {events.map((ev, i) => (
        <EventCard key={i} ev={ev} />
      ))}
    </div>
  );
}

function EventCard({ ev }: { ev: EventItem }) {
  const place = [ev.venue, ev.neighborhood ?? ev.borough]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {ev.category && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground">
                {ev.category}
              </span>
            )}
            {(ev.date || ev.time) && (
              <span className="text-[10.5px] font-medium text-accent">
                {[formatEventDate(ev.date), ev.time].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
          <h4 className="mt-1 truncate text-[12.5px] font-semibold leading-snug text-foreground">
            {ev.name}
          </h4>
          {ev.description && (
            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
              {ev.description}
            </p>
          )}
          {place && (
            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPinIcon size={10} weight="bold" className="shrink-0" />
              <span className="truncate">{place}</span>
            </div>
          )}
        </div>
        {ev.url && (
          <a
            href={ev.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${ev.name}`}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
          >
            <ArrowSquareOutIcon size={13} weight="bold" />
          </a>
        )}
      </div>
      {typeof ev.lat === "number" && typeof ev.lng === "number" && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-medium text-accent hover:underline"
        >
          <NavigationArrowIcon size={10} weight="fill" />
          <span>Get directions in Google Maps</span>
        </a>
      )}
    </div>
  );
}

// ── Directions button (getDirections tool) ─────────────────────────────────

function DirectionsButton({ result }: { result: Record<string, unknown> }) {
  const url = result.url as string;
  const dest = (result.destination as string) ?? "destination";
  const origin = (result.origin as string) ?? "Current location";
  const mode = (result.travelMode as string) ?? "driving";

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 transition-colors hover:border-accent/60 hover:bg-accent/15"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <CompassIcon size={14} weight="fill" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold text-foreground">
          Directions to {dest}
        </span>
        <span className="block truncate text-[10.5px] text-muted-foreground">
          {origin} · {mode}
        </span>
      </span>
      <ArrowSquareOutIcon
        size={13}
        weight="bold"
        className="shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
      />
    </a>
  );
}

// ── Trip card (planTrip tool) ──────────────────────────────────────────────

type TripPoint = { name: string; lng: number; lat: number };
type TripMode = {
  mode: "walking" | "bicycling" | "transit" | "driving";
  etaMinutes: number;
  url: string;
};
type TripResult = {
  origin: TripPoint;
  destination: TripPoint;
  distanceMeters: number;
  modes: TripMode[];
  recommended: TripMode["mode"];
};

const MODE_META: Record<
  TripMode["mode"],
  { label: string; emoji: string }
> = {
  walking: { label: "Walk", emoji: "🚶" },
  bicycling: { label: "Bike", emoji: "🚲" },
  transit: { label: "Transit", emoji: "🚇" },
  driving: { label: "Drive", emoji: "🚗" },
};

function TripCard({
  result,
  onMapCommand,
  toolCallId,
}: {
  result: Record<string, unknown>;
  onMapCommand: (cmd: MapCommand, toolCallId: string) => void;
  toolCallId: string;
}) {
  const trip = result as unknown as TripResult;
  const fired = useRef(false);

  // On first paint, ask the map to frame both endpoints.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const lngs = [trip.origin.lng, trip.destination.lng];
    const lats = [trip.origin.lat, trip.destination.lat];
    onMapCommand(
      {
        action: "fitBounds",
        bounds: [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
      },
      `${toolCallId}:fit`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const km = (trip.distanceMeters / 1000).toFixed(
    trip.distanceMeters < 1000 ? 2 : 1,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-surface/40 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
          <span className="truncate">{trip.origin.name}</span>
          <span className="text-muted-foreground">→</span>
          <span className="truncate">{trip.destination.name}</span>
        </div>
        <div className="mt-0.5 text-[10.5px] text-muted-foreground">
          {km} km · recommended:{" "}
          <span className="text-accent">
            {MODE_META[trip.recommended].label.toLowerCase()}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border">
        {trip.modes.map((m) => {
          const meta = MODE_META[m.mode];
          const isReco = m.mode === trip.recommended;
          return (
            <a
              key={m.mode}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className={[
                "group flex items-center gap-2 px-3 py-2.5 transition-colors",
                isReco
                  ? "bg-accent/10 hover:bg-accent/20"
                  : "bg-card hover:bg-muted",
              ].join(" ")}
            >
              <span className="text-[16px]">{meta.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-foreground">
                  {meta.label}
                </span>
                <span className="block text-[10.5px] text-muted-foreground">
                  ~{m.etaMinutes} min
                </span>
              </span>
              <ArrowSquareOutIcon
                size={11}
                weight="bold"
                className="shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}

function describeTool(
  toolName: string,
  result: Record<string, unknown>,
  isComplete: boolean,
): string | null {
  if (!isComplete) return null;
  switch (toolName) {
    case "addMapLayer":
      return typeof result.name === "string" ? result.name : null;
    case "removeMapLayer":
      return typeof result.target === "string"
        ? result.target === "all"
          ? "all layers"
          : result.target
        : null;
    case "flyToLocation":
      return typeof result.locationName === "string"
        ? result.locationName
        : null;
    case "searchCategories":
      return Array.isArray(result) ? `${result.length} found` : null;
    case "searchCatalog":
      return Array.isArray((result as { datasets?: unknown[] }).datasets)
        ? `${(result as { datasets: unknown[] }).datasets.length} datasets`
        : null;
    default:
      return null;
  }
}

const TOOL_LABELS: Record<string, string> = {
  searchCategories: "Searching layers",
  searchCatalog: "Searching datasets",
  addMapLayer: "Added layer",
  removeMapLayer: "Removed layer",
  flyToLocation: "Flew to",
  fetchDatasetDirect: "Fetched dataset",
  summarizeFeatures: "Analyzed data",
  searchEvents: "Searching events",
  getDirections: "Built directions",
};

/** Pretty-print a YYYY-MM-DD into "Sat Nov 15", null/empty input returns "". */
function formatEventDate(date: string | undefined): string {
  if (!date) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}
