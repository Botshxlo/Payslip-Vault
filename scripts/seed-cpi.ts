/**
 * Seeds the cpi_data table from the static sa-cpi.json file.
 * Usage: tsx scripts/seed-cpi.ts
 */

import { join } from "node:path";
import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { getTursoClient } from "../src/lib/turso.js";

loadEnvFile(join(import.meta.dirname!, "..", ".env"));

async function main() {
  const jsonPath = join(import.meta.dirname!, "..", "web", "src", "data", "sa-cpi.json");
  const cpiData: Record<string, number> = JSON.parse(readFileSync(jsonPath, "utf-8"));

  const client = getTursoClient();
  const now = new Date().toISOString();

  console.log(`Seeding ${Object.keys(cpiData).length} CPI entries...`);

  for (const [month, value] of Object.entries(cpiData)) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO cpi_data (month, value, updated_at) VALUES (?, ?, ?)`,
      args: [month, value, now],
    });
  }

  console.log("Seed complete.");
}

main();
