import { task, logger } from "@trigger.dev/sdk/v3";
import { extractPayslipAttachment } from "../lib/gmail.js";
import { stripPdfPassword } from "../lib/decrypt-pdf.js";
import { encryptBuffer } from "../lib/encrypt.js";
import { uploadToGoogleDrive, payslipExists } from "../lib/storage.js";
import { notifySlack, notifyDuplicate, notifyPayslipChanges } from "../lib/notify.js";
import { extractPayslipText, parsePayslipData } from "../lib/parse-payslip.js";
import { storePayslipData, getPreviousPayslipData } from "../lib/payslip-store.js";
import { detectChanges } from "../lib/detect-changes.js";

export const processPayslip = task({
  id: "process-payslip",
  retry: { maxAttempts: 3 },
  run: async ({ messageId }: { messageId: string }) => {
    logger.info("Extracting payslip attachment", { messageId });
    const { filename, pdfBuffer } = await extractPayslipAttachment(messageId);

    const baseName = filename.replace(/\.pdf$/i, "");
    if (await payslipExists(baseName)) {
      logger.info("Payslip already exists in Drive, skipping", { filename });
      await notifyDuplicate(filename);
      return { success: true, skipped: true };
    }

    logger.info("Stripping PDF password", { filename });
    const unlockedPdf = await stripPdfPassword(
      pdfBuffer,
      process.env.ID_NUMBER!
    );

    logger.info("Encrypting with AES-256-GCM");
    const encrypted = encryptBuffer(unlockedPdf, process.env.VAULT_SECRET!);

    const encryptedFilename = `${filename.replace(/\.pdf$/i, "")}_${Date.now()}.enc`;

    logger.info("Uploading to Google Drive", { encryptedFilename });
    const driveFile = await uploadToGoogleDrive(encrypted, encryptedFilename);

    logger.info("Sending Slack notification");
    await notifySlack({
      filename,
      driveFileId: driveFile.id!,
      driveFileName: driveFile.name!,
    });

    // Extract payslip data and store in Turso
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const payslipDate = dateMatch[1];
      try {
        logger.info("Extracting payslip data", { payslipDate });
        const text = await extractPayslipText(unlockedPdf);
        const payslipData = parsePayslipData(text);
        await storePayslipData(driveFile.id!, payslipDate, payslipData, process.env.VAULT_SECRET!);

        // Change detection
        const previous = await getPreviousPayslipData(payslipDate, process.env.VAULT_SECRET!);
        if (previous) {
          const changes = detectChanges(payslipData, previous.data);
          if (changes.length > 0) {
            logger.info("Payslip changes detected", { count: changes.length });
            await notifyPayslipChanges(payslipDate, changes);
          }
        }
      } catch (err) {
        // Don't fail the whole task if data extraction fails
        logger.error("Failed to extract/store payslip data", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Payslip processed successfully", {
      driveFileId: driveFile.id,
    });
    return { success: true, driveFileId: driveFile.id };
  },
});
