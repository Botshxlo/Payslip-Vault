import { schedules, logger } from "@trigger.dev/sdk/v3";
import { checkTokenExpiry } from "../lib/token-check.js";
import { notifyTokenWarning } from "../lib/notify.js";

export const tokenExpiryCheck = schedules.task({
  id: "token-expiry-check",
  cron: "0 9 * * 1", // Monday 09:00 UTC (11:00 SAST)
  run: async () => {
    const results = await Promise.all([
      checkTokenExpiry(
        process.env.GMAIL_CLIENT_ID!,
        process.env.GMAIL_CLIENT_SECRET!,
        process.env.GMAIL_REFRESH_TOKEN!,
        "Gmail"
      ),
      checkTokenExpiry(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        process.env.GOOGLE_REFRESH_TOKEN!,
        "Google Drive"
      ),
    ]);

    const warnings = results.filter((r) => !r.healthy);

    if (warnings.length > 0) {
      const message = warnings
        .map((w) => `*${w.label}:* ${w.message}`)
        .join("\n");
      await notifyTokenWarning(message);
      logger.warn("Token warnings sent", { warnings });
    } else {
      logger.info("All tokens healthy");
    }

    return { results };
  },
});
