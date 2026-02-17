#!/usr/bin/env tsx

import { google } from "googleapis";

async function main() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "subject:payslip has:attachment",
    maxResults: 5,
  });

  const messages = res.data.messages ?? [];
  console.log(`Found ${messages.length} payslip email(s)\n`);

  for (const m of messages) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: m.id!,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });
    const headers = msg.data.payload?.headers ?? [];
    const subject = headers.find((h) => h.name === "Subject")?.value;
    const from = headers.find((h) => h.name === "From")?.value;
    const date = headers.find((h) => h.name === "Date")?.value;
    const labels = msg.data.labelIds ?? [];
    console.log(`ID: ${m.id}`);
    console.log(`From: ${from}`);
    console.log(`Subject: ${subject}`);
    console.log(`Date: ${date}`);
    console.log(`Unread: ${labels.includes("UNREAD")}\n`);
  }
}

main();
