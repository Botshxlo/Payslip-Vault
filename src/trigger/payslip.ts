import { task, logger } from "@trigger.dev/sdk/v3";
import { extractPayslipAttachment } from "../lib/gmail.js";
import { stripPdfPassword } from "../lib/decrypt-pdf.js";
import { encryptBuffer } from "../lib/encrypt.js";
import { uploadToGoogleDrive, payslipExists } from "../lib/storage.js";
import { notifySlack } from "../lib/notify.js";

export const processPayslip = task({
  id: "process-payslip",
  retry: { maxAttempts: 3 },
  run: async ({ messageId }: { messageId: string }) => {
    logger.info("Extracting payslip attachment", { messageId });
    const { filename, pdfBuffer } = await extractPayslipAttachment(messageId);

    const baseName = filename.replace(/\.pdf$/i, "");
    if (await payslipExists(baseName)) {
      logger.info("Payslip already exists in Drive, skipping", { filename });
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

    logger.info("Payslip processed successfully", {
      driveFileId: driveFile.id,
    });
    return { success: true, driveFileId: driveFile.id };
  },
});
