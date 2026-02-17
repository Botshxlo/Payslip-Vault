#!/usr/bin/env tsx

import { tasks } from "@trigger.dev/sdk/v3";
import type { processPayslip } from "../src/trigger/payslip.js";

async function main() {
  const messageId = process.argv[2];
  if (!messageId) {
    console.error("Usage: npx tsx scripts/test-trigger.ts <messageId>");
    process.exit(1);
  }

  console.log(`Triggering process-payslip for message: ${messageId}`);
  const handle = await tasks.trigger<typeof processPayslip>("process-payslip", {
    messageId,
  });
  console.log(`Triggered! Run ID: ${handle.id}`);
  console.log("Check progress at https://cloud.trigger.dev");
}

main();
