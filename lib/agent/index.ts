import { searchCategories } from "./tools/search-categories";
import { searchCatalog } from "./tools/search-catalog";
import { addMapLayer } from "./tools/fetch-layer";
import { removeMapLayer, flyToLocation } from "./tools/map-control";
import { fetchDatasetDirect } from "./tools/fetch-dataset-direct";
import { summarizeFeatures } from "./tools/summarize-features";
import { searchEvents } from "./tools/search-events";
import { getDirections } from "./tools/get-directions";
import { planTrip } from "./tools/plan-trip";
import { buildSystemPrompt } from "./system-prompt";

export const agentSystemPrompt = buildSystemPrompt();

export const agentTools = {
  searchCategories,
  searchCatalog,
  addMapLayer,
  removeMapLayer,
  flyToLocation,
  fetchDatasetDirect,
  summarizeFeatures,
  searchEvents,
  getDirections,
  planTrip,
};
