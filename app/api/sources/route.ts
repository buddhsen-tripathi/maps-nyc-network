import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/sources/registry";

export function GET() {
  const res = NextResponse.json({
    count: SOURCES.length,
    sources: SOURCES,
  });
  // Static config from the in-process registry; cache hard like categories.
  res.headers.set(
    "Cache-Control",
    "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  );
  return res;
}
