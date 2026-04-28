import type { Category } from "./types";

/**
 * Property keys to try as a popup title, in priority order. Covers
 * the most common naming conventions across NYC Open Data datasets.
 */
const TITLE_KEYS = [
  "name",
  "dba",
  "signname",
  "school_name",
  "library_name",
  "park_name",
  "park",
  "station_name",
  "station",
  "stop_name",
  "address",
  "house_number",
  "owner_name",
  "owner",
  "facility_name",
  "agency_name",
  "agency",
  "borough_name",
  "boro_name",
  "boroname",
  "borough",
  "neighborhood",
  "ntaname",
  "nta_name",
  "precinct",
  "pct",
  "councildist",
  "cong_dist",
  "sd_num",
  "cd",
  "cb_num",
  "bid",
  "bid_name",
  "historic_district_name",
  "designation",
  "title",
  "label",
  "spc_common",
  "spc_latin",
  "cuisine_description",
  "type",
  "category",
];

const HIDE_KEY =
  /^(:@|the_geom|geometry|geom|shape|created|updated|modifie|x_coord|y_coord|object_?id|location_?point|location_?1|computed_region|globalid|_uuid)/i;
const MAX_FIELDS = 5;

export type PopupViewModel = {
  title: string;
  fields: { key: string; value: string }[];
  badge?: string;
};

export function buildPopupModel(
  props: Record<string, unknown> | null | undefined,
  category: Pick<Category, "name">,
): PopupViewModel {
  const safe = (props ?? {}) as Record<string, unknown>;
  const title = pickTitle(safe) ?? category.name;
  const titleStr = toStringLabel(title);
  const fields: { key: string; value: string }[] = [];

  for (const [k, v] of Object.entries(safe)) {
    if (HIDE_KEY.test(k)) continue;
    if (toStringLabel(v) === titleStr) continue;
    const value = formatValue(v);
    if (!value) continue;
    fields.push({ key: humanize(k), value });
    if (fields.length >= MAX_FIELDS) break;
  }

  return { title: titleStr, fields, badge: category.name };
}

function pickTitle(props: Record<string, unknown>): string | null {
  for (const key of TITLE_KEYS) {
    const s = toStringLabel(props[key]);
    if (s && s.length <= 80) return s;
  }
  for (const [k, v] of Object.entries(props)) {
    if (HIDE_KEY.test(k)) continue;
    const s = toStringLabel(v);
    if (s && s.length > 1 && s.length <= 80) return s;
  }
  return null;
}

function toStringLabel(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function formatValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s.length > 160) return "";
    return s;
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return "";
}

function humanize(key: string): string {
  return key
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const escapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => escapeMap[c] ?? c);
}

const card = [
  "background:var(--color-surface)",
  "color:var(--color-foreground)",
  "border:1px solid var(--color-border)",
  "border-radius:6px",
  "min-width:210px",
  "max-width:300px",
  "box-shadow:0 10px 30px -10px rgba(0,0,0,0.55), 0 2px 6px -2px rgba(0,0,0,0.4)",
  "overflow:hidden",
  "font-family:var(--font-sans)",
].join(";");

const headerRow = [
  "display:flex",
  "align-items:center",
  "gap:8px",
  "border-bottom:1px solid var(--color-border)",
  "padding:8px 10px",
].join(";");

const dot = (color: string) =>
  [
    "height:8px",
    "width:8px",
    "border-radius:999px",
    `background:${color}`,
    "flex-shrink:0",
  ].join(";");

const titleStyle = [
  "font-size:12.5px",
  "font-weight:600",
  "line-height:1.3",
  "white-space:nowrap",
  "overflow:hidden",
  "text-overflow:ellipsis",
].join(";");

const body = "padding:6px 10px;";

const row = [
  "display:flex",
  "align-items:baseline",
  "justify-content:space-between",
  "gap:12px",
  "padding:2px 0",
].join(";");

const keyStyle = [
  "font-size:10px",
  "text-transform:uppercase",
  "letter-spacing:0.06em",
  "color:var(--color-subtle)",
  "flex-shrink:0",
].join(";");

const valStyle = [
  "font-size:11.5px",
  "color:var(--color-foreground)",
  "text-align:right",
  "max-width:65%",
  "overflow:hidden",
  "text-overflow:ellipsis",
  "white-space:nowrap",
].join(";");

const emptyStyle = [
  "padding:4px 0",
  "font-size:11px",
  "color:var(--color-muted-foreground)",
].join(";");

const badgeStyle = [
  "margin-top:6px",
  "border-top:1px solid var(--color-border)",
  "padding-top:6px",
  "font-size:10px",
  "text-transform:uppercase",
  "letter-spacing:0.06em",
  "color:var(--color-subtle)",
].join(";");

export function renderPopupHTML(
  model: PopupViewModel,
  accentColor: string,
): string {
  const fields = model.fields.length
    ? model.fields
        .map(
          (f) => `
            <div style="${row}">
              <span style="${keyStyle}">${escapeHtml(f.key)}</span>
              <span style="${valStyle}">${escapeHtml(f.value)}</span>
            </div>`,
        )
        .join("")
    : `<div style="${emptyStyle}">No additional details.</div>`;

  const badge = model.badge
    ? `<div style="${badgeStyle}">${escapeHtml(model.badge)}</div>`
    : "";

  return `
    <div style="${card}">
      <div style="${headerRow}">
        <span style="${dot(accentColor)}"></span>
        <span style="${titleStyle}">${escapeHtml(model.title)}</span>
      </div>
      <div style="${body}">${fields}${badge}</div>
    </div>
  `;
}
