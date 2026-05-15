/**
 * Resolve natural-language time windows ("tonight", "this weekend") into
 * concrete NYC date ranges. Used by searchEvents so the LLM can't drift on
 * what "today" means and we can server-side filter out-of-range events.
 */

export type DateWindow = {
  /** Inclusive start, ISO YYYY-MM-DD in America/New_York. */
  start: string;
  /** Inclusive end, ISO YYYY-MM-DD in America/New_York. */
  end: string;
  /** Human description for prompt clarity. */
  label: string;
};

/** Today's date in NYC, as YYYY-MM-DD. */
function nycToday(): Date {
  // Build a Date that, when formatted as ISO, reflects NYC's current calendar day.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
  // Construct UTC midnight on the NYC calendar day so date arithmetic stays sane.
  return new Date(Date.UTC(y, (m as number) - 1, d));
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(d: Date): number {
  // 0 = Sunday, 6 = Saturday
  return d.getUTCDay();
}

function weekdayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function resolveTimeWindow(when: string | undefined | null): DateWindow {
  const today = nycToday();
  const w = (when ?? "today").trim().toLowerCase();

  // Default end-of-day handling: time is dropped, only YYYY-MM-DD.
  let start = today;
  let end = today;
  let label = `today (${weekdayLabel(today)})`;

  if (
    w === "today" ||
    w === "now" ||
    w === "tonight" ||
    w === "this evening"
  ) {
    // single day
  } else if (w === "tomorrow" || w === "tomorrow night") {
    start = addDays(today, 1);
    end = start;
    label = `tomorrow (${weekdayLabel(start)})`;
  } else if (w === "this weekend") {
    // Sat–Sun. If today is mid-week, pick upcoming weekend.
    // If today is Fri, Sat, or Sun, include the *current* weekend.
    const dow = dayOfWeek(today);
    let satOffset: number;
    if (dow === 6) satOffset = 0; // Sat
    else if (dow === 0) satOffset = -1; // Sun → prior Sat
    else if (dow === 5) satOffset = 1; // Fri → tomorrow
    else satOffset = (6 - dow + 7) % 7; // next Sat
    start = addDays(today, satOffset);
    end = addDays(start, 1);
    label = `this weekend (${weekdayLabel(start)}–${weekdayLabel(end)})`;
  } else if (w === "next weekend") {
    const dow = dayOfWeek(today);
    const nextSatOffset = ((6 - dow + 7) % 7) + 7;
    start = addDays(today, nextSatOffset);
    end = addDays(start, 1);
    label = `next weekend (${weekdayLabel(start)}–${weekdayLabel(end)})`;
  } else if (
    w === "this week" ||
    w === "rest of the week" ||
    w === "this week's events"
  ) {
    // today through next Sunday (inclusive)
    const dow = dayOfWeek(today);
    const sundayOffset = (7 - dow) % 7; // 0 if today is Sunday
    end = addDays(today, sundayOffset || 7); // if today is Sunday, span to next Sunday
    label = `this week (${weekdayLabel(start)}–${weekdayLabel(end)})`;
  } else if (w === "next week") {
    const dow = dayOfWeek(today);
    const mondayOffset = ((1 - dow + 7) % 7) || 7; // upcoming Monday
    start = addDays(today, mondayOffset);
    end = addDays(start, 6);
    label = `next week (${weekdayLabel(start)}–${weekdayLabel(end)})`;
  } else if (
    /^next\s+(\d+)\s+days?$/.test(w) ||
    /^the\s+next\s+(\d+)\s+days?$/.test(w)
  ) {
    const n = Math.min(
      Math.max(Number(w.match(/(\d+)/)?.[1] ?? "7"), 1),
      30,
    );
    end = addDays(today, n - 1);
    label = `next ${n} days (${weekdayLabel(start)}–${weekdayLabel(end)})`;
  } else if (w === "this month") {
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );
    start = today > monthStart ? today : monthStart;
    end = monthEnd;
    label = `this month (through ${weekdayLabel(end)})`;
  } else {
    // Unrecognized, fall back to today + 7 days. Keep the original label so
    // the LLM still sees what the user asked for, but constrain the window.
    end = addDays(today, 7);
    label = `${when ?? "today"} (${weekdayLabel(start)}–${weekdayLabel(end)})`;
  }

  return { start: iso(start), end: iso(end), label };
}

/** Inclusive range check against YYYY-MM-DD strings. */
export function isInWindow(date: string | undefined, window: DateWindow): boolean {
  if (!date) return false;
  const d = date.slice(0, 10); // tolerate ISO datetimes
  return d >= window.start && d <= window.end;
}
