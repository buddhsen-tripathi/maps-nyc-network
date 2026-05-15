"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  PaperPlaneTiltIcon,
  XIcon,
  SparkleIcon,
  ArrowClockwiseIcon,
  ArrowUpRightIcon,
  MapPinIcon,
} from "@phosphor-icons/react";
import { ChatMessage } from "./ChatMessage";
import { Icon } from "./Icon";
import type { MapCommand } from "@/lib/agent/types";
import { AGENT_MODES } from "@/lib/agent/modes";

type Props = {
  onMapCommand: (cmd: MapCommand, toolCallId: string) => void;
  /** Fires when the user submits a new prompt. Lets the host reset map state. */
  onTurnStart?: () => void;
  onClose: () => void;
};

const SUGGESTIONS: { title: string; prompt: string; badge?: string }[] = [
  {
    title: "What's happening in NYC today?",
    prompt: "What's happening in NYC today? Find events, concerts, exhibits, and markets I shouldn't miss.",
    badge: "live web",
  },
  {
    title: "Free things to do this weekend",
    prompt: "Find free events happening in NYC this weekend",
    badge: "live web",
  },
  {
    title: "Where can I find a bike near Union Square?",
    prompt: "Show available Citi Bike stations near Union Square",
  },
  {
    title: "Recent 311 complaints in Bushwick",
    prompt: "Show 311 service requests in Bushwick from the last week",
  },
  {
    title: "Find community spaces in Williamsburg",
    prompt: "Find community gardens, libraries, and parks in Williamsburg",
  },
];

export function ChatPanel({ onMapCommand, onTurnStart, onClose }: Props) {
  const [input, setInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<
    { lat: number; lng: number } | null
  >(null);
  const [locStatus, setLocStatus] = useState<"idle" | "pending" | "denied">(
    "idle",
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Refs mirror state so the transport's body fn always reads the latest.
  const modeRef = useRef<string | null>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    modeRef.current = selectedMode;
  });
  useEffect(() => {
    locationRef.current = userLocation;
  });

  const requestLocation = () => {
    if (userLocation) {
      // Toggle off
      setUserLocation(null);
      setLocStatus("idle");
      return;
    }
    if (!navigator.geolocation) {
      setLocStatus("denied");
      return;
    }
    setLocStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocStatus("idle");
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  // Per-mount transport: body fn returns the live mode + location each request.
  // The body callback runs at request time (not render), so reading refs here
  // is intentional. The lint rule can't see the callback boundary.
  /* eslint-disable react-hooks/refs */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: () => ({
          mode: modeRef.current ?? undefined,
          location: locationRef.current ?? undefined,
        }),
      }),
    [],
  );
  /* eslint-enable react-hooks/refs */

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  // Autoscroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || isLoading) return;
    setInput("");
    onTurnStart?.();
    sendMessage({ text: t });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-r border-border bg-surface">
      {/* Header */}
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <SparkleIcon size={15} weight="fill" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="text-[13px] font-semibold tracking-tight text-foreground">
            Map Assistant
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Powered by live NYC data
          </p>
        </div>
        <button
          type="button"
          onClick={requestLocation}
          aria-label={
            userLocation ? "Stop sharing location" : "Share my location"
          }
          title={
            userLocation
              ? "Sharing your location with the agent"
              : locStatus === "denied"
                ? "Location denied, try again or check browser permissions"
                : "Share your location for 'near me' queries"
          }
          aria-pressed={!!userLocation}
          className={[
            "rounded p-1.5 transition-colors hover:bg-muted",
            userLocation
              ? "text-accent"
              : locStatus === "denied"
                ? "text-danger"
                : "text-muted-foreground hover:text-foreground",
            locStatus === "pending" ? "animate-pulse" : "",
          ].join(" ")}
        >
          <MapPinIcon size={14} weight={userLocation ? "fill" : "bold"} />
        </button>
        {!isEmpty && (
          <button
            type="button"
            onClick={resetChat}
            aria-label="New chat"
            title="New chat"
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowClockwiseIcon size={14} weight="bold" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon size={14} weight="bold" />
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {isEmpty ? (
          <EmptyState onPick={submit} />
        ) : (
          <div className="flex flex-col gap-1 px-3 py-3">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onMapCommand={onMapCommand}
              />
            ))}
            {isLoading && messages.at(-1)?.role === "user" && (
              <ThinkingBubble />
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border p-3"
      >
        {/* Mode picker, biases the agent's persona */}
        <div className="mb-2 flex flex-wrap gap-1">
          {AGENT_MODES.map((m) => {
            const active = selectedMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  setSelectedMode((curr) => (curr === m.id ? null : m.id))
                }
                title={m.description}
                aria-pressed={active}
                className={[
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                  active
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-border-strong hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <Icon name={m.icon} size={10} weight="bold" />
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 transition-colors focus-within:border-border-strong focus-within:ring-1 focus-within:ring-ring/40">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about NYC… (Shift+Enter for newline)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] leading-5 text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <PaperPlaneTiltIcon size={13} weight="fill" />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
          The assistant can add map layers and fly to NYC locations.
        </p>
      </form>
    </aside>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-8">
      <div className="mb-5 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/30">
          <SparkleIcon size={22} weight="fill" />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          Ask me anything about NYC
        </h3>
        <p className="mt-1 max-w-[260px] text-[12px] leading-relaxed text-muted-foreground">
          I can pull live data, add map layers, and fly to neighborhoods.
        </p>
      </div>

      <div className="mt-2 space-y-1.5">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Try one of these
        </p>
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-muted"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[12.5px] leading-snug text-foreground">
                {s.title}
              </span>
              {s.badge && (
                <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-accent">
                  {s.badge}
                </span>
              )}
            </span>
            <ArrowUpRightIcon
              size={13}
              weight="bold"
              className="shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
        <SparkleIcon size={12} weight="fill" />
      </div>
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}
