import "server-only";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local before running.",
  );
}

export const sql = neon(url);
