import { tool, generateObject } from "ai";
import { z } from "zod";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { geocodeEvent } from "../geocode";
import { resolveTimeWindow, isInWindow } from "../time-window";
import { memoize } from "@/lib/cache";

const apiKey = process.env.OPENROUTER_API_KEY;
const openrouter = apiKey ? createOpenRouter({ apiKey }) : null;

// Use a web-search-enabled model. The `:online` suffix tells OpenRouter to
// run a Google-backed web search before completion.
const ONLINE_MODEL = "google/gemini-2.5-flash:online";

/**
 * Allowed event-listing domains. We reject events whose URL doesn't come from
 * one of these (or another "*.org" with "/event" path), a simple guard
 * against the model fabricating URLs.
 */
const TRUSTED_DOMAINS = [
  // Aggregators / discovery
  "lu.ma",
  "luma.com",
  "eventbrite.com",
  "meetup.com",
  "partiful.com",
  "dice.fm",
  "songkick.com",
  "bandsintown.com",
  "ra.co", // Resident Advisor
  "residentadvisor.net",
  "ticketmaster.com",
  "sg.eventbrite.com",
  "ticketweb.com",
  "seetickets.us",
  "fever.com",
  "do.timeout.com",
  // Editorial / city
  "timeout.com",
  "secretnyc.co",
  "nycgo.com",
  "nyc.gov",
  "centralparknyc.org",
  "prospectpark.org",
  "bric-arts.org",
  "bam.org",
  "lincolncenter.org",
  "summerstage.org",
  "moma.org",
  "metmuseum.org",
  "guggenheim.org",
  "whitney.org",
  "brooklynmuseum.org",
  "publictheater.org",
  "92ny.org",
  "kingstheatre.com",
  "irvingplaza.com",
  "websternyc.com",
  "brooklynsteel.net",
  "brooklynbowl.com",
  "knockdown.center",
  "nowadays.nyc",
  "kingsland.com",
  "bowerypresents.com",
  // Generic newsletters
  "letterboxd.com",
];

function urlLooksTrustworthy(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (TRUSTED_DOMAINS.some((d) => host === d || host.endsWith("." + d))) {
      return true;
    }
    // Allow .org/.gov/.edu venue sites with an event-ish path.
    if (
      (host.endsWith(".org") ||
        host.endsWith(".gov") ||
        host.endsWith(".edu")) &&
      /\b(event|calendar|show|exhibit|program|whats-on|tickets?)\b/i.test(
        u.pathname,
      )
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

const eventSchema = z.object({
  name: z.string().describe("Event name"),
  description: z
    .string()
    .optional()
    .describe("One-sentence description (max 160 chars)"),
  date: z
    .string()
    .optional()
    .describe(
      "ISO date YYYY-MM-DD when the event happens. Required for events spanning a single day; for runs, use the soonest date inside the requested window.",
    ),
  time: z
    .string()
    .optional()
    .describe(
      'Human time, e.g. "8pm", "Sat 3-6pm", "Doors 7pm". Pair with date when possible.',
    ),
  venue: z.string().optional().describe("Venue name"),
  neighborhood: z
    .string()
    .optional()
    .describe("NYC neighborhood (e.g. 'Williamsburg')"),
  borough: z
    .enum(["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"])
    .optional()
    .describe("NYC borough only, drop events outside the five boroughs."),
  url: z
    .string()
    .optional()
    .describe(
      "Direct event URL. Prefer Luma, Eventbrite, Resident Advisor, Time Out, official venue sites.",
    ),
  category: z
    .string()
    .optional()
    .describe(
      "Type: music, food, art, sports, family, free, nightlife, market, etc.",
    ),
});

export type AgentEvent = z.infer<typeof eventSchema>;

export const searchEvents = tool({
  description:
    "Search the live web for things happening in NYC (events, concerts, " +
    "festivals, exhibits, markets, etc.). Use whenever the user asks about " +
    "what's happening today, tonight, this weekend, or events in a " +
    "specific neighborhood. Returns up to 8 events with venue + URL.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "What events to look for. Examples: 'free concerts', 'food festivals', 'art exhibits in Brooklyn'. Do NOT include the time window here, pass it via `when`.",
      ),
    when: z
      .string()
      .describe(
        "Time window phrased EXACTLY as the user did when possible. Supported: 'today', 'tonight', 'tomorrow', 'this weekend', 'next weekend', 'this week', 'next week', 'next N days', 'this month'. If the user gave no window, pass 'today'.",
      ),
    neighborhood: z
      .string()
      .optional()
      .describe("Specific NYC neighborhood or borough to filter by"),
  }),
  execute: async ({ query, when, neighborhood }) => {
    if (!openrouter) {
      return { events: [], error: "OPENROUTER_API_KEY not configured" };
    }

    const window = resolveTimeWindow(when);
    const cacheKey = `events:${query}|${window.start}-${window.end}|${neighborhood ?? ""}`;

    // 5-minute cache so repeat questions don't burn extra :online credits.
    return memoize(cacheKey, 5 * 60_000, () =>
      runSearch({ query, when, neighborhood, window }),
    );
  },
});

async function runSearch(params: {
  query: string;
  when: string;
  neighborhood?: string;
  window: ReturnType<typeof resolveTimeWindow>;
}) {
  const { query, when, neighborhood, window } = params;
  if (!openrouter) {
    return { events: [], error: "OPENROUTER_API_KEY not configured" };
  }

  const sourcesHint = [
    "Luma (lu.ma)",
    "Eventbrite",
    "Partiful",
    "Resident Advisor (ra.co)",
    "DICE",
    "Songkick / Bandsintown",
    "Time Out NYC",
    "Secret NYC",
    "Meetup",
    "official venue/museum/park sites (.org/.gov)",
  ].join(", ");

  const prompt = [
    `You are an NYC events finder. Find real events in New York City matching the user's query.`,
    ``,
    `USER QUERY: "${query}"`,
    `TIME WINDOW: ${window.label}`,
    `DATE RANGE: ${window.start} to ${window.end} (inclusive, NYC time). Only include events with at least one occurrence inside this range.`,
    neighborhood ? `LOCATION FILTER: ${neighborhood}` : "",
    ``,
    `STRICT RULES:`,
    `1. Only return events you can verify from current web search results. If you can't find verified events for this exact window, return an empty events array.`,
    `2. Do NOT invent dates, venues, URLs, or events.`,
    `3. URLs MUST be real event pages from these preferred sources: ${sourcesHint}.`,
    `4. Events must be inside NYC's five boroughs.`,
    `5. Return up to 8 unique events. Skip duplicates.`,
    `6. Always populate the "date" field with YYYY-MM-DD.`,
    `7. Cite specific events from your search results, do not summarize generic "things to do".`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: openrouter(ONLINE_MODEL),
      schema: z.object({ events: z.array(eventSchema).max(8) }),
      prompt,
      temperature: 0.2,
    });

    // Server-side guardrails: drop events that fail trust/range checks.
    const filtered = object.events.filter((e) => {
      // 1. Date must fall inside the requested window when provided.
      if (e.date && !isInWindow(e.date, window)) return false;
      // 2. URL, if given, must look real. Missing URL is OK.
      if (e.url && !urlLooksTrustworthy(e.url)) return false;
      // 3. Need at least a venue or a neighborhood to be useful.
      if (!e.venue && !e.neighborhood && !e.borough) return false;
      return true;
    });

    // Geocode in parallel so the frontend can plot pins.
    const geocoded = await Promise.all(
      filtered.map(async (ev) => {
        const coords = await geocodeEvent({
          venue: ev.venue,
          neighborhood: ev.neighborhood,
          borough: ev.borough,
          name: ev.name,
        });
        return coords ? { ...ev, lat: coords.lat, lng: coords.lng } : ev;
      }),
    );

    const mappable = geocoded.filter(
      (e): e is AgentEvent & { lat: number; lng: number } =>
        typeof (e as { lat?: unknown }).lat === "number",
    );

    return {
      query,
      when,
      window: { start: window.start, end: window.end, label: window.label },
      neighborhood: neighborhood ?? null,
      events: geocoded,
      count: geocoded.length,
      mappableCount: mappable.length,
      droppedCount: object.events.length - filtered.length,
    };
  } catch (err) {
    console.error("searchEvents failed:", err);
    return { events: [], error: "Could not fetch events right now" };
  }
}
