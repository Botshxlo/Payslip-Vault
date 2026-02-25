import { schedules, logger } from "@trigger.dev/sdk/v3";
import { getTursoClient } from "../lib/turso.js";
import { encryptBuffer } from "../lib/encrypt.js";
import {
  uploadBackupToDrive,
  listBackupFiles,
  trashDriveFile,
} from "../lib/storage.js";
import { notifyBackup } from "../lib/notify.js";

const BACKUP_RETENTION_WEEKS = 4;

export const backupDatabase = schedules.task({
  id: "backup-database",
  cron: "0 2 * * 0", // Sunday at 02:00 UTC (04:00 SAST)
  run: async () => {
    const vaultSecret = process.env.VAULT_SECRET!;
    const db = getTursoClient();

    // 1. Export all tables as JSON
    logger.info("Exporting database tables");

    const [payslipResult, cpiResult, statusResult] = await Promise.all([
      db.execute("SELECT * FROM payslip_data"),
      db.execute("SELECT * FROM cpi_data"),
      db.execute("SELECT * FROM system_status"),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      tables: {
        payslip_data: payslipResult.rows,
        cpi_data: cpiResult.rows,
        system_status: statusResult.rows,
      },
    };

    const jsonBuffer = Buffer.from(JSON.stringify(backup), "utf-8");

    // 2. Encrypt the JSON dump
    logger.info("Encrypting backup", { bytes: jsonBuffer.length });
    const encrypted = encryptBuffer(jsonBuffer, vaultSecret);

    // 3. Upload to Drive
    const date = new Date().toISOString().split("T")[0];
    const filename = `backup-${date}.enc`;
    logger.info("Uploading backup to Drive", { filename });
    await uploadBackupToDrive(encrypted, filename);

    // 4. Trash old backups (older than BACKUP_RETENTION_WEEKS)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_WEEKS * 7);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const allFiles = await listBackupFiles();
    const oldBackups = allFiles.filter((f) => {
      if (!f.name?.startsWith("backup-")) return false;
      const dateMatch = f.name.match(/backup-(\d{4}-\d{2}-\d{2})\.enc/);
      if (!dateMatch) return false;
      return dateMatch[1] < cutoffStr;
    });

    for (const file of oldBackups) {
      logger.info("Trashing old backup", { name: file.name });
      await trashDriveFile(file.id!);
    }

    // 5. Update heartbeat
    await db.execute({
      sql: `INSERT OR REPLACE INTO system_status (key, value, updated_at) VALUES (?, ?, ?)`,
      args: ["last_backup", "ok", new Date().toISOString()],
    });

    // 6. Notify
    await notifyBackup(
      filename,
      payslipResult.rows.length,
      cpiResult.rows.length
    );

    logger.info("Backup complete", {
      filename,
      payslipRows: payslipResult.rows.length,
      cpiRows: cpiResult.rows.length,
      oldBackupsTrashed: oldBackups.length,
    });

    return {
      filename,
      payslipRows: payslipResult.rows.length,
      cpiRows: cpiResult.rows.length,
      oldBackupsTrashed: oldBackups.length,
    };
  },
});
