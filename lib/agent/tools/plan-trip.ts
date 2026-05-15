import { tool } from "ai";
import { z } from "zod";
import { geocodeNyc } from "../geocode";

/**
 * Multi-modal trip plan: resolves origin + destination, returns Google Maps
 * URLs for walking / bicycling / transit / driving along with rough ETAs and
 * a recommended mode. The frontend renders this as a TripCard with mode
 * buttons that open the Maps app.
 *
 * Use for "plan my commute", "trip from X to Y", "best way to get from A to B".
 * For single-mode "how do I get there" use getDirections instead.
 */
export const planTrip = tool({
  description:
    "Plan a multi-modal trip between two NYC locations. Returns side-by-side " +
    "ETAs and Google Maps links for walking, biking, transit, and driving. " +
    "Use for 'plan a commute', 'best way from X to Y', 'compare transit options'. " +
    "If origin or destination is missing or vague, ASK the user first, don't guess.",
  inputSchema: z.object({
    origin: z
      .string()
      .describe(
        'Origin: place name, address, "lat,lng", or "current location" / "near me".',
      ),
    destination: z
      .string()
      .describe(
        'Destination: place name, address, or "lat,lng".',
      ),
    originLng: z
      .number()
      .optional()
      .describe("Optional pre-resolved origin longitude (if known)."),
    originLat: z
      .number()
      .optional()
      .describe("Optional pre-resolved origin latitude."),
    destLng: z
      .number()
      .optional()
      .describe("Optional pre-resolved destination longitude."),
    destLat: z
      .number()
      .optional()
      .describe("Optional pre-resolved destination latitude."),
  }),
  execute: async ({
    origin,
    destination,
    originLng,
    originLat,
    destLng,
    destLat,
  }) => {
    const resolveCoords = async (
      raw: string,
      hintLng?: number,
      hintLat?: number,
    ): Promise<{ name: string; lng: number; lat: number } | null> => {
      if (hintLng != null && hintLat != null) {
        return { name: raw, lng: hintLng, lat: hintLat };
      }
      // "lat,lng" pair
      const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (m) {
        return { name: raw, lat: Number(m[1]), lng: Number(m[2]) };
      }
      const c = await geocodeNyc(`${raw}, NYC`);
      if (!c) return null;
      return { name: c.label ?? raw, lng: c.lng, lat: c.lat };
    };

    const [from, to] = await Promise.all([
      resolveCoords(origin, originLng, originLat),
      resolveCoords(destination, destLng, destLat),
    ]);

    if (!from) {
      return {
        ok: false,
        error: `Could not resolve origin "${origin}". Ask the user for a more specific NYC place or address.`,
      };
    }
    if (!to) {
      return {
        ok: false,
        error: `Could not resolve destination "${destination}". Ask the user for a more specific NYC place or address.`,
      };
    }

    const distanceMeters = haversineMeters(from.lat, from.lng, to.lat, to.lng);

    // Crude door-to-door ETAs (minutes). Includes typical waiting/walking
    // overhead for transit/bike share so the comparison feels realistic.
    const walkMin = Math.max(2, Math.round((distanceMeters / 1.3) / 60));
    const bikeMin = Math.max(3, Math.round((distanceMeters / 4.5) / 60) + 4);
    const transitMin = Math.max(8, Math.round((distanceMeters / 7.5) / 60) + 7);
    const driveMin = Math.max(4, Math.round((distanceMeters / 8.5) / 60) + 3);

    const buildUrl = (mode: "walking" | "bicycling" | "transit" | "driving") =>
      `https://www.google.com/maps/dir/?${new URLSearchParams({
        api: "1",
        origin: `${from.lat},${from.lng}`,
        destination: `${to.lat},${to.lng}`,
        travelmode: mode,
      }).toString()}`;

    const modes = [
      { mode: "walking" as const, etaMinutes: walkMin, url: buildUrl("walking") },
      { mode: "bicycling" as const, etaMinutes: bikeMin, url: buildUrl("bicycling") },
      { mode: "transit" as const, etaMinutes: transitMin, url: buildUrl("transit") },
      { mode: "driving" as const, etaMinutes: driveMin, url: buildUrl("driving") },
    ];

    // Recommend by distance band, with bias for transit on long NYC trips.
    let recommended: "walking" | "bicycling" | "transit" | "driving";
    if (distanceMeters < 1200) recommended = "walking";
    else if (distanceMeters < 4000) recommended = "bicycling";
    else recommended = "transit";

    return {
      ok: true,
      origin: from,
      destination: to,
      distanceMeters: Math.round(distanceMeters),
      modes,
      recommended,
    };
  },
});

/** Haversine distance between two lat/lng points in meters. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
