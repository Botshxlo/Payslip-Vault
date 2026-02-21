import { schedules, logger } from "@trigger.dev/sdk/v3";
import { decryptBuffer } from "../lib/encrypt.js";
import {
  extractPayslipText,
  parsePayslipData,
} from "../lib/parse-payslip.js";
import { storePayslipData, payslipDataExists } from "../lib/payslip-store.js";
import { getTursoClient } from "../lib/turso.js";
import { listVaultFiles, downloadEncFile } from "../lib/storage.js";

export const syncPayslipData = schedules.task({
  id: "sync-payslip-data",
  cron: "0 5 * * *", // Daily at 05:00 UTC (07:00 SAST)
  run: async () => {
    const vaultSecret = process.env.VAULT_SECRET!;

    // 1. List all .enc files in Drive "Payslip Vault" folder
    logger.info("Listing Drive vault files");
    const driveFiles = await listVaultFiles();
    const driveFileIds = new Set(driveFiles.map((f) => f.id!));

    logger.info(`Found ${driveFiles.length} file(s) in Drive`);

    // 2. List all rows in Turso
    const db = getTursoClient();
    const result = await db.execute(
      "SELECT drive_file_id FROM payslip_data"
    );
    const tursoFileIds = new Set(
      result.rows.map((r) => r.drive_file_id as string)
    );

    // 3. Add missing: Drive files not in Turso
    const missing = driveFiles.filter((f) => !tursoFileIds.has(f.id!));
    let added = 0;

    for (const file of missing) {
      const dateMatch = file.name?.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) {
        logger.warn("Skipping file with no date in name", {
          name: file.name,
        });
        continue;
      }

      // Double-check to avoid race conditions
      if (await payslipDataExists(file.id!)) continue;

      try {
        logger.info("Ingesting missing payslip", {
          name: file.name,
          id: file.id,
        });

        const encData = await downloadEncFile(file.id!);
        const pdfBuffer = decryptBuffer(encData, vaultSecret);
        const text = await extractPayslipText(pdfBuffer);
        const data = parsePayslipData(text);

        await storePayslipData(
          file.id!,
          dateMatch[1],
          data,
          vaultSecret
        );
        added++;
      } catch (err) {
        logger.error("Failed to ingest payslip", {
          name: file.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 4. Remove stale: Turso rows whose drive_file_id no longer exists in Drive
    const stale = [...tursoFileIds].filter((id) => !driveFileIds.has(id));
    let removed = 0;

    if (stale.length > 0) {
      logger.info(`Removing ${stale.length} stale row(s) from Turso`);
      for (const fileId of stale) {
        await db.execute({
          sql: "DELETE FROM payslip_data WHERE drive_file_id = ?",
          args: [fileId],
        });
        removed++;
      }
    }

    logger.info("Sync complete", {
      driveFiles: driveFiles.length,
      added,
      removed,
      unchanged: driveFiles.length - added,
    });

    return { driveFiles: driveFiles.length, added, removed };
  },
});
