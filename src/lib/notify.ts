interface NotifyPayload {
  filename: string;
  driveFileId: string;
  driveFileName: string;
}

export async function notifySlack({
  filename,
  driveFileId,
  driveFileName,
}: NotifyPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("SLACK_WEBHOOK_URL is not set");

  const now = new Date().toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    dateStyle: "full",
    timeStyle: "short",
  });

  const body = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Payslip Secured",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Original File:*\n${filename}` },
          { type: "mrkdwn", text: `*Stored As:*\n${driveFileName}` },
          { type: "mrkdwn", text: `*Encryption:*\nAES-256-GCM` },
          { type: "mrkdwn", text: `*Received:*\n${now}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Payslip" },
            url: `${process.env.VIEWER_BASE_URL}/view/${driveFileId}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Password-protected \u00b7 Decrypted in your browser only",
          },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }
}
