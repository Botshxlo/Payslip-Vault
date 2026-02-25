/**
 * Creates the system_status table in Turso.
 * Usage: tsx scripts/migrate-status.ts
 */

import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { getTursoClient } from "../src/lib/turso.js";

loadEnvFile(join(import.meta.dirname!, "..", ".env"));

async function main() {
  const client = getTursoClient();

  console.log("Creating system_status table...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS system_status (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  console.log("Migration complete.");
}

main();
