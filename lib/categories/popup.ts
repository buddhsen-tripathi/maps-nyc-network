import type { Category, PopupConfig } from "./types";

/**
 * Property keys to try as a popup title, in priority order. Borough names
 * are deliberately excluded: they're rarely the most useful title and
 * tend to hijack any feature that lives in NYC.
 */
const TITLE_KEYS = [
  "name",
  "dba",
  "signname",
  "label",
  "title",
  "school_name",
  "library_name",
  "park_name",
  "park",
  "station_name",
  "station",
  "stop_name",
  "address",
  "owner_name",
  "owner",
  "facility_name",
  "agency_name",
  "agency",
  "spc_common",
  "spc_latin",
  "cuisine_description",
];

const HIDE_KEY =
  /^(:@|the_geom|geometry|geom|shape_(area|leng|le_\d|ar_\d|stle)|created|updated|modifie|x_coord|y_coord|xcoord|ycoord|point_x$|point_y$|object_?id|location_?point|location_?1|computed_region|globalid|_uuid|gispropnum|omppropid|stateplane_)/i;
const MAX_FIELDS = 5;

export type PopupViewModel = {
  title: string;
  fields: { key: string; value: string }[];
  badge?: string;
};

export function buildPopupModel(
  props: Record<string, unknown> | null | undefined,
  category: Pick<Category, "name"> & { popup?: PopupConfig },
): PopupViewModel {
  const safe = (props ?? {}) as Record<string, unknown>;

  const overrideTitle = applyTitleSpec(category.popup?.title, safe);
  const overrideFields = applyFieldsSpec(category.popup?.fields, safe);

  const title =
    overrideTitle ?? pickTitle(safe) ?? category.name;
  const titleStr = toStringLabel(title);

  const fields = overrideFields ?? heuristicFields(safe, titleStr);

  return { title: titleStr, fields, badge: category.name };
}

function applyTitleSpec(
  spec: string | undefined,
  props: Record<string, unknown>,
): string | null {
  if (!spec) return null;
  if (spec.includes("{")) {
    let substituted = false;
    const out = spec.replace(/\{(\w+)\}/g, (_, key) => {
      const v = props[key];
      const s = toStringLabel(v);
      if (s) substituted = true;
      return s;
    });
    const trimmed = out.trim();
    return substituted && trimmed ? trimmed : null;
  }
  const v = toStringLabel(props[spec]);
  return v && v.length <= 120 ? v : null;
}

function applyFieldsSpec(
  spec: PopupConfig["fields"],
  props: Record<string, unknown>,
): { key: string; value: string }[] | null {
  if (!spec) return null;
  return spec
    .map(({ key, label }) => {
      const value = formatValue(props[key]);
      return value ? { key: label, value } : null;
    })
    .filter((x): x is { key: string; value: string } => x !== null);
}

function heuristicFields(
  props: Record<string, unknown>,
  titleStr: string,
): { key: string; value: string }[] {
  const fields: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (HIDE_KEY.test(k)) continue;
    if (toStringLabel(v) === titleStr) continue;
    const value = formatValue(v);
    if (!value) continue;
    fields.push({ key: humanize(k), value });
    if (fields.length >= MAX_FIELDS) break;
  }
  return fields;
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

const actionRowStyle = [
  "margin-top:10px",
  "padding-top:10px",
  "border-top:1px solid var(--color-border)",
].join(";");

const actionLinkStyle = [
  "display:flex",
  "align-items:center",
  "justify-content:center",
  "gap:6px",
  "width:100%",
  "box-sizing:border-box",
  "font-size:12px",
  "font-weight:500",
  "color:var(--color-foreground)",
  "background:var(--color-muted)",
  "border:1px solid var(--color-border)",
  "border-radius:5px",
  "padding:7px 10px",
  "text-decoration:none",
  "transition:border-color 120ms ease, background 120ms ease",
].join(";");

export type PopupAction = {
  href: string;
  label: string;
};

export function renderPopupHTML(
  model: PopupViewModel,
  accentColor: string,
  opts: { actions?: PopupAction[] } = {},
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

  const actions = opts.actions?.length
    ? `<div style="${actionRowStyle}">${opts.actions
        .map(
          (a) => `<a href="${escapeHtml(a.href)}" target="_blank" rel="noreferrer" style="${actionLinkStyle}">${escapeHtml(a.label)}<span aria-hidden="true">&#8599;</span></a>`,
        )
        .join("")}</div>`
    : "";

  return `
    <div style="${card}">
      <div style="${headerRow}">
        <span style="${dot(accentColor)}"></span>
        <span style="${titleStyle}">${escapeHtml(model.title)}</span>
      </div>
      <div style="${body}">${fields}${badge}${actions}</div>
    </div>
  `;
}

export function googleMapsUrl(lng: number, lat: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
