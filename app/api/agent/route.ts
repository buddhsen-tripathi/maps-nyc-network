import { NextResponse } from "next/server";
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { agentSystemPrompt, agentTools } from "@/lib/agent";
import { AGENT_MODES_BY_ID } from "@/lib/agent/modes";

export const maxDuration = 60;

const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
const MAX_AGENT_STEPS = 8;

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

  const {
    messages,
    mode,
    location,
  }: {
    messages: UIMessage[];
    mode?: string;
    location?: { lat: number; lng: number };
  } = await req.json();

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
  });

  return result.toUIMessageStreamResponse();
}
