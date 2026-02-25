import { schedules, logger } from "@trigger.dev/sdk/v3";
import { getTursoClient } from "../lib/turso.js";
import { notifyHealthAlert } from "../lib/notify.js";

const CHECKS = [
  { key: "last_payslip_sync", label: "Payslip sync", maxAgeHours: 26 },
  { key: "last_cpi_sync", label: "CPI sync", maxAgeDays: 35 },
] as const;

export const healthCheck = schedules.task({
  id: "health-check",
  cron: "0 6 * * *", // Daily at 06:00 UTC (08:00 SAST)
  run: async () => {
    const db = getTursoClient();
    const alerts: string[] = [];
    const now = Date.now();

    for (const check of CHECKS) {
      const result = await db.execute({
        sql: "SELECT updated_at FROM system_status WHERE key = ?",
        args: [check.key],
      });

      if (result.rows.length === 0) {
        alerts.push(`*${check.label}:* No heartbeat found — task may have never run successfully.`);
        continue;
      }

      const updatedAt = new Date(result.rows[0].updated_at as string).getTime();
      const maxAgeMs = "maxAgeHours" in check
        ? check.maxAgeHours * 60 * 60 * 1000
        : check.maxAgeDays * 24 * 60 * 60 * 1000;
      const ageMs = now - updatedAt;

      if (ageMs > maxAgeMs) {
        const ageHours = Math.round(ageMs / (60 * 60 * 1000));
        const ageLabel = ageHours >= 24
          ? `${Math.round(ageHours / 24)}d ago`
          : `${ageHours}h ago`;
        alerts.push(`*${check.label}:* Last heartbeat ${ageLabel} — expected within ${"maxAgeHours" in check ? `${check.maxAgeHours}h` : `${check.maxAgeDays}d`}.`);
      }
    }

    if (alerts.length > 0) {
      logger.warn("Health check failed", { alerts });
      await notifyHealthAlert(alerts);
      return { status: "alert", alerts };
    }

    logger.info("All systems healthy");
    return { status: "healthy" };
  },
});
