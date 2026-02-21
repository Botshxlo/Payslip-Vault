import { schedules, logger } from "@trigger.dev/sdk/v3";
import { findPayslipEmails, markAsRead, deleteEmail } from "../lib/gmail.js";
import { processPayslip } from "./payslip.js";

export const pollGmailForPayslips = schedules.task({
  id: "poll-gmail-for-payslips",
  cron: "*/10 7-14 20-26 * 1-5", // Every 10 min, 07:00–14:59 UTC, 20th–26th, weekdays
  run: async () => {
    const messageIds = await findPayslipEmails();
    logger.info(`Found ${messageIds.length} unread payslip email(s)`);

    for (const messageId of messageIds) {
      const result = await processPayslip.triggerAndWait({ messageId });
      if (result.ok) {
        await deleteEmail(messageId);
        logger.info("Processed and trashed email", { messageId });
      } else {
        await markAsRead(messageId);
        logger.error("Processing failed, marked as read only", { messageId });
      }
    }

    return { emailsFound: messageIds.length };
  },
});
