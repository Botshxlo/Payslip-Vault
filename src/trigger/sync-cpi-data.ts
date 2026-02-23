import { schedules, logger } from "@trigger.dev/sdk/v3";
import { fetchSACPI } from "../lib/fred.js";
import { getTursoClient } from "../lib/turso.js";

export const syncCpiData = schedules.task({
  id: "sync-cpi-data",
  cron: "0 1 1 * *", // 1st of month, 01:00 UTC (03:00 SAST)
  run: async () => {
    try {
      logger.info("Fetching SA CPI data from FRED");
      const observations = await fetchSACPI();
      logger.info(`Fetched ${observations.length} observations`);

      const db = getTursoClient();
      const now = new Date().toISOString();
      let upserted = 0;

      for (const obs of observations) {
        await db.execute({
          sql: `INSERT OR REPLACE INTO cpi_data (month, value, updated_at) VALUES (?, ?, ?)`,
          args: [obs.month, obs.value, now],
        });
        upserted++;
      }

      logger.info("CPI sync complete", { upserted });
      return { upserted };
    } catch (err) {
      logger.error("CPI sync failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});
