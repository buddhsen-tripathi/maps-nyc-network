import { NextResponse } from "next/server";
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { agentSystemPrompt, agentTools } from "@/lib/agent";
import { AGENT_MODES_BY_ID } from "@/lib/agent/modes";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const maxDuration = 60;

const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";

// Tunables. Override per deploy via env vars if you need to scale up.
const PER_IP_LIMIT = Number(process.env.AGENT_PER_IP_LIMIT ?? 10);
const PER_IP_WINDOW_MS =
  Number(process.env.AGENT_PER_IP_WINDOW_MIN ?? 10) * 60_000;
const PER_IP_DAILY_LIMIT = Number(process.env.AGENT_PER_IP_DAILY_LIMIT ?? 100);
const PER_IP_DAILY_WINDOW_MS = 24 * 60 * 60_000;
const GLOBAL_LIMIT = Number(process.env.AGENT_GLOBAL_LIMIT ?? 500);
const GLOBAL_WINDOW_MS =
  Number(process.env.AGENT_GLOBAL_WINDOW_MIN ?? 60) * 60_000;
const MAX_BODY_BYTES = 100_000; // 100KB; way more than any sensible chat history
const MAX_OUTPUT_TOKENS = 1500; // per model call
const MAX_AGENT_STEPS = 8; // max tool-call loops per turn

type LimitReason = "global" | "daily" | "burst";

function tooManyRequests(
  retryAfterMs: number,
  message: string,
  reason: LimitReason,
) {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new NextResponse(
    JSON.stringify({
      error: message,
      reason,
      retryAfterMs,
      retryAfterSeconds: seconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(seconds),
      },
    },
  );
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Soft-fail so the rest of the app keeps working when the key isn't set.
    return NextResponse.json(
      {
        error:
          "Agent is unavailable. Set OPENROUTER_API_KEY in .env.local to enable the chat assistant.",
      },
      { status: 503 },
    );
  }

  // Global cost ceiling first. Cheaper to reject before parsing the body.
  const globalCheck = rateLimit("agent:global", GLOBAL_LIMIT, GLOBAL_WINDOW_MS);
  if (!globalCheck.allowed) {
    return tooManyRequests(
      globalCheck.retryAfterMs,
      "The map assistant is taking a breather. Try again in a few minutes.",
      "global",
    );
  }

  // Per-client daily cap. Hits this if the user is having a chatty day.
  const ip = getClientIp(req);
  const dailyCheck = rateLimit(
    `agent:ip:daily:${ip}`,
    PER_IP_DAILY_LIMIT,
    PER_IP_DAILY_WINDOW_MS,
  );
  if (!dailyCheck.allowed) {
    return tooManyRequests(
      dailyCheck.retryAfterMs,
      `Daily limit reached (${PER_IP_DAILY_LIMIT} messages per 24 hours). Try again later.`,
      "daily",
    );
  }

  // Per-client short-window throttle. Catches bursts and bots.
  const burstCheck = rateLimit(
    `agent:ip:${ip}`,
    PER_IP_LIMIT,
    PER_IP_WINDOW_MS,
  );
  if (!burstCheck.allowed) {
    return tooManyRequests(
      burstCheck.retryAfterMs,
      `You're sending messages a bit fast. Wait ~${Math.ceil(burstCheck.retryAfterMs / 1000)}s and try again.`,
      "burst",
    );
  }

  // Reject oversized bodies before doing any model work.
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large." },
      { status: 413 },
    );
  }

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large." },
      { status: 413 },
    );
  }

  let parsed: {
    messages: UIMessage[];
    mode?: string;
    location?: { lat: number; lng: number };
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { messages, mode, location } = parsed;

  const persona = mode ? AGENT_MODES_BY_ID.get(mode)?.personaPrompt : undefined;
  const locationLine = location
    ? `USER LOCATION: lat=${location.lat.toFixed(5)}, lng=${location.lng.toFixed(5)}. When the user says "near me", "around me", "nearby", or asks for things close to their current spot, use these as nearLng/nearLat for addMapLayer.`
    : undefined;

  const system = [agentSystemPrompt, persona, locationLine]
    .filter(Boolean)
    .join("\n\n");

  const openrouter = createOpenRouter({ apiKey });
  const result = streamText({
    model: openrouter(MODEL),
    system,
    messages: await convertToModelMessages(messages),
    tools: agentTools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    temperature: 0.2,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  return result.toUIMessageStreamResponse();
}
