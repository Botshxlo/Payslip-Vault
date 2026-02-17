import { schedules, logger } from "@trigger.dev/sdk/v3";
import { findPayslipEmails, markAsRead } from "../lib/gmail.js";
import { processPayslip } from "./payslip.js";

export const pollGmailForPayslips = schedules.task({
  id: "poll-gmail-for-payslips",
  cron: "0 * * * *", // Every hour
  run: async () => {
    const messageIds = await findPayslipEmails();
    logger.info(`Found ${messageIds.length} unread payslip email(s)`);

    for (const messageId of messageIds) {
      await processPayslip.trigger({ messageId });
      await markAsRead(messageId);
      logger.info("Triggered processing and marked as read", { messageId });
    }

    return { emailsFound: messageIds.length };
  },
});
