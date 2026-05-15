import { tool } from "ai";
import { z } from "zod";
import { CATEGORIES_BY_ID } from "@/lib/categories/registry";

export const removeMapLayer = tool({
  description:
    "Remove a map layer or clear all layers from the map. " +
    "Omit categoryId to remove everything.",
  inputSchema: z.object({
    categoryId: z
      .string()
      .optional()
      .describe("Category ID to remove. Omit to clear all layers."),
  }),
  execute: async ({ categoryId }) => {
    if (categoryId && !CATEGORIES_BY_ID.has(categoryId)) {
      return { removed: false, error: `Unknown category: ${categoryId}` };
    }
    return { removed: true, target: categoryId ?? "all" };
  },
});

// ── NYC location lookup table ──

type Location = { center: [number, number]; zoom: number };

const LOCATIONS: Record<string, Location> = {
  // Boroughs
  manhattan: { center: [-73.9712, 40.7831], zoom: 12 },
  brooklyn: { center: [-73.9442, 40.6782], zoom: 12 },
  queens: { center: [-73.7949, 40.7282], zoom: 11 },
  bronx: { center: [-73.8648, 40.8448], zoom: 12 },
  "staten island": { center: [-74.1502, 40.5795], zoom: 12 },

  // Manhattan neighborhoods
  "lower manhattan": { center: [-74.0099, 40.7074], zoom: 14 },
  "financial district": { center: [-74.0071, 40.7075], zoom: 15 },
  tribeca: { center: [-74.0084, 40.7163], zoom: 15 },
  soho: { center: [-73.9993, 40.7233], zoom: 15 },
  "greenwich village": { center: [-73.9973, 40.7336], zoom: 15 },
  "east village": { center: [-73.9843, 40.7265], zoom: 15 },
  "west village": { center: [-74.0029, 40.7358], zoom: 15 },
  "lower east side": { center: [-73.9845, 40.7151], zoom: 15 },
  chinatown: { center: [-73.9976, 40.7158], zoom: 15 },
  "little italy": { center: [-73.9975, 40.7191], zoom: 16 },
  nolita: { center: [-73.9954, 40.7234], zoom: 16 },
  chelsea: { center: [-74.0014, 40.7465], zoom: 15 },
  "hell's kitchen": { center: [-73.9918, 40.7638], zoom: 15 },
  midtown: { center: [-73.9845, 40.7549], zoom: 14 },
  "murray hill": { center: [-73.9784, 40.7488], zoom: 15 },
  gramercy: { center: [-73.9845, 40.7382], zoom: 15 },
  "flatiron district": { center: [-73.9903, 40.7411], zoom: 15 },
  "union square": { center: [-73.9903, 40.7359], zoom: 15 },
  "upper east side": { center: [-73.9597, 40.7736], zoom: 14 },
  "upper west side": { center: [-73.9753, 40.7870], zoom: 14 },
  harlem: { center: [-73.9465, 40.8116], zoom: 14 },
  "east harlem": { center: [-73.9425, 40.7957], zoom: 14 },
  "washington heights": { center: [-73.9383, 40.8417], zoom: 14 },
  inwood: { center: [-73.9213, 40.8677], zoom: 14 },
  "morningside heights": { center: [-73.9614, 40.8097], zoom: 15 },

  // Brooklyn neighborhoods
  williamsburg: { center: [-73.9571, 40.7081], zoom: 14 },
  "park slope": { center: [-73.9791, 40.6710], zoom: 14 },
  "downtown brooklyn": { center: [-73.9857, 40.6929], zoom: 15 },
  dumbo: { center: [-73.9882, 40.7033], zoom: 15 },
  "brooklyn heights": { center: [-73.9935, 40.6960], zoom: 15 },
  "fort greene": { center: [-73.9740, 40.6895], zoom: 15 },
  "bed-stuy": { center: [-73.9416, 40.6872], zoom: 14 },
  bushwick: { center: [-73.9213, 40.6942], zoom: 14 },
  greenpoint: { center: [-73.9510, 40.7282], zoom: 14 },
  "red hook": { center: [-74.0065, 40.6745], zoom: 15 },
  "crown heights": { center: [-73.9416, 40.6694], zoom: 14 },
  flatbush: { center: [-73.9614, 40.6525], zoom: 14 },
  "prospect heights": { center: [-73.9686, 40.6773], zoom: 15 },
  "cobble hill": { center: [-73.9947, 40.6868], zoom: 15 },
  "carroll gardens": { center: [-73.9994, 40.6795], zoom: 15 },
  "bay ridge": { center: [-74.0235, 40.6349], zoom: 14 },
  "brighton beach": { center: [-73.9617, 40.5780], zoom: 14 },
  "coney island": { center: [-73.9787, 40.5749], zoom: 14 },
  "sunset park": { center: [-74.0065, 40.6458], zoom: 14 },

  // Queens neighborhoods
  astoria: { center: [-73.9235, 40.7721], zoom: 14 },
  "long island city": { center: [-73.9485, 40.7433], zoom: 14 },
  "jackson heights": { center: [-73.8816, 40.7505], zoom: 14 },
  flushing: { center: [-73.8328, 40.7654], zoom: 14 },
  "forest hills": { center: [-73.8447, 40.7188], zoom: 14 },
  "jamaica": { center: [-73.7902, 40.7023], zoom: 14 },
  "rego park": { center: [-73.8562, 40.7261], zoom: 14 },
  sunnyside: { center: [-73.9062, 40.7434], zoom: 14 },
  woodside: { center: [-73.9038, 40.7454], zoom: 14 },
  "rockaway beach": { center: [-73.8108, 40.5834], zoom: 14 },

  // Bronx neighborhoods
  "south bronx": { center: [-73.9180, 40.8187], zoom: 14 },
  fordham: { center: [-73.8976, 40.8614], zoom: 14 },
  riverdale: { center: [-73.9058, 40.8959], zoom: 14 },
  "pelham bay": { center: [-73.8365, 40.8534], zoom: 14 },
  "arthur avenue": { center: [-73.8894, 40.8554], zoom: 15 },
  "city island": { center: [-73.7870, 40.8468], zoom: 14 },

  // Staten Island neighborhoods
  "st. george": { center: [-74.0776, 40.6433], zoom: 14 },
  "tottenville": { center: [-74.2510, 40.5037], zoom: 14 },

  // Landmarks
  "times square": { center: [-73.9855, 40.7580], zoom: 16 },
  "central park": { center: [-73.9654, 40.7829], zoom: 14 },
  "prospect park": { center: [-73.9690, 40.6602], zoom: 14 },
  "brooklyn bridge": { center: [-73.9969, 40.7061], zoom: 16 },
  "statue of liberty": { center: [-74.0445, 40.6892], zoom: 15 },
  "empire state building": { center: [-73.9857, 40.7484], zoom: 16 },
  "world trade center": { center: [-74.0134, 40.7127], zoom: 16 },
  "barclays center": { center: [-73.9753, 40.6826], zoom: 16 },
  "yankee stadium": { center: [-73.9262, 40.8296], zoom: 16 },
  "citi field": { center: [-73.8458, 40.7571], zoom: 16 },
  "madison square garden": { center: [-73.9934, 40.7505], zoom: 16 },
  "lincoln center": { center: [-73.9836, 40.7725], zoom: 16 },
  "grand central": { center: [-73.9772, 40.7527], zoom: 16 },
  "penn station": { center: [-73.9937, 40.7506], zoom: 16 },
  "columbia university": { center: [-73.9626, 40.8075], zoom: 15 },
  nyu: { center: [-73.9965, 40.7295], zoom: 15 },
  "jfk airport": { center: [-73.7781, 40.6413], zoom: 13 },
  "laguardia airport": { center: [-73.8740, 40.7769], zoom: 14 },
  "governors island": { center: [-74.0167, 40.6895], zoom: 15 },
  "hudson yards": { center: [-74.0005, 40.7536], zoom: 16 },
  "highline": { center: [-74.0049, 40.7480], zoom: 15 },
  "wall street": { center: [-74.0090, 40.7069], zoom: 16 },
  "battery park": { center: [-74.0169, 40.7033], zoom: 15 },
};

export const flyToLocation = tool({
  description:
    "Pan and zoom the map to a specific NYC location, borough, neighborhood, or landmark.",
  inputSchema: z.object({
    location: z
      .string()
      .describe(
        "NYC location name: a neighborhood, landmark, address, or borough",
      ),
  }),
  execute: async ({ location }) => {
    const key = location.toLowerCase().trim();
    const loc = LOCATIONS[key];

    if (loc) {
      return { center: loc.center, zoom: loc.zoom, locationName: location };
    }

    // Try partial match
    const partial = Object.entries(LOCATIONS).find(([k]) => k.includes(key) || key.includes(k));
    if (partial) {
      return {
        center: partial[1].center,
        zoom: partial[1].zoom,
        locationName: partial[0],
      };
    }

    return {
      center: [-73.9857, 40.7484] as [number, number],
      zoom: 11,
      locationName: location,
      note: `Could not find exact coordinates for "${location}". Showing NYC overview.`,
    };
  },
});
