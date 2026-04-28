import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "../lib/db";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const schemaPath = resolve(here, "..", "lib", "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf8");

  const statements = schema
    .split(/;\s*$/m)
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);

  for (const [i, stmt] of statements.entries()) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    console.log(`[${i + 1}/${statements.length}] ${preview}…`);
    await sql.query(stmt);
  }

  console.log(`Applied ${statements.length} statements.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
