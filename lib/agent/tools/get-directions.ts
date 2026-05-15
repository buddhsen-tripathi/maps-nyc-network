import { tool } from "ai";
import { z } from "zod";
import { geocodeNyc } from "../geocode";

/**
 * Build a Google Maps directions URL the user can open in their app or browser.
 * Uses the universal "Maps URLs" v1 spec so it works on iOS, Android, and web.
 *  https://developers.google.com/maps/documentation/urls/get-started
 */
export const getDirections = tool({
  description:
    "Generate a Google Maps directions URL from origin to destination. " +
    "Use whenever the user asks how to get somewhere, the route to a place, " +
    'directions, or "open in Google Maps". The frontend renders the URL as a ' +
    "clickable button in chat. If origin is omitted, Google Maps uses the " +
    "user's current location.",
  inputSchema: z.object({
    destination: z
      .string()
      .describe(
        'Destination as a place name, address, or "lat,lng" pair (e.g. "Brooklyn Museum", "200 Eastern Pkwy, Brooklyn", "40.6712,-73.9636")',
      ),
    origin: z
      .string()
      .optional()
      .describe(
        'Optional origin. Omit to default to "Current Location". Same format as destination.',
      ),
    travelMode: z
      .enum(["walking", "driving", "transit", "bicycling"])
      .optional()
      .describe("Travel mode. Defaults to driving."),
  }),
  execute: async ({ destination, origin, travelMode }) => {
    // Try to enrich a NYC venue name with coords for accuracy. If it already
    // looks like a lat,lng or full address, leave it alone.
    const isCoordsOrAddress = (s: string) =>
      /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(s) || /\d/.test(s);

    let resolvedDest = destination;
    let destLabel: string | undefined;
    if (!isCoordsOrAddress(destination)) {
      const c = await geocodeNyc(`${destination}, NYC`);
      if (c) {
        resolvedDest = `${c.lat},${c.lng}`;
        destLabel = c.label ?? destination;
      }
    }

    const params = new URLSearchParams({
      api: "1",
      destination: resolvedDest,
    });
    if (origin) params.set("origin", origin);
    if (travelMode) params.set("travelmode", travelMode);

    const url = `https://www.google.com/maps/dir/?${params.toString()}`;

    return {
      url,
      destination: destLabel ?? destination,
      origin: origin ?? "Current location",
      travelMode: travelMode ?? "driving",
    };
  },
});
