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
      cluster: c.cluster ?? false,
      paint: c.paint,
      options: c.options ?? [],
      popup: c.popup,
      refresh: c.refresh ?? 0,
      tween: c.tween,
    })),
  });
  // Pure config from the in-process registry. Effectively immutable per
  // deploy, so cache hard. Edge serves stale for a week while a single
  // background refresh on deploy picks up the new build.
  res.headers.set(
    "Cache-Control",
    "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  );
  return res;
}
