import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories/registry";
import { THEMES } from "@/lib/categories/themes";

export function GET() {
  const res = NextResponse.json({
    themes: THEMES,
    categories: CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      theme: c.theme,
      icon: c.icon,
      description: c.description,
      kind: c.kind,
      paint: c.paint,
      options: c.options ?? [],
      popup: c.popup,
    })),
  });
  // Pure config from the in-process registry; safe to cache aggressively.
  res.headers.set(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  return res;
}
