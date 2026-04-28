import { neon } from "@neondatabase/serverless";

/**
 * Bare Neon connection. Imported by both the server runtime and Bun
 * scripts. Keep this file free of "server-only" so scripts can run.
 * The server-only guard lives in ./index.ts.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local before running.",
  );
}

export const sql = neon(url);
