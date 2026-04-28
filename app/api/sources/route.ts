import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/sources/registry";

export function GET() {
  const res = NextResponse.json({
    count: SOURCES.length,
    sources: SOURCES,
  });
  res.headers.set(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=86400",
  );
  return res;
}
