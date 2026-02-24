/**
 * Seeds the cpi_data table with initial SA CPI data.
 * One-time script — data is now maintained by the sync-cpi-data Trigger task.
 * Usage: npx tsx scripts/seed-cpi.ts
 */

import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { getTursoClient } from "../src/lib/turso.js";

loadEnvFile(join(import.meta.dirname!, "..", ".env"));

const INITIAL_CPI: Record<string, number> = {
  "2024-01": 152.97,
  "2024-02": 154.23,
  "2024-03": 155.48,
  "2024-04": 155.80,
  "2024-05": 156.11,
  "2024-06": 156.27,
  "2024-07": 156.90,
  "2024-08": 157.05,
  "2024-09": 157.21,
  "2024-10": 157.21,
  "2024-11": 157.05,
  "2024-12": 157.21,
  "2025-01": 157.68,
};

async function main() {
  const client = getTursoClient();
  const now = new Date().toISOString();

  console.log(`Seeding ${Object.keys(INITIAL_CPI).length} CPI entries...`);

  for (const [month, value] of Object.entries(INITIAL_CPI)) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO cpi_data (month, value, updated_at) VALUES (?, ?, ?)`,
      args: [month, value, now],
    });
  }

  console.log("Seed complete.");
}

main();
