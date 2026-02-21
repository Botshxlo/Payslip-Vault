import { gmail_v1, auth as gmailAuth } from "@googleapis/gmail";
import { OAuth2Client } from "google-auth-library";

function getAuth(): OAuth2Client {
  const auth = new OAuth2Client(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return auth;
}

function getGmail() {
  return new gmail_v1.Gmail({ auth: getAuth() });
}

/**
 * Searches Gmail for unread payslip emails with attachments.
 * NOTE: You may need to refine the query with a specific sender address.
 */
export async function findPayslipEmails(): Promise<string[]> {
  const gmail = getGmail();
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "from:noreply-ss@simplepay.cloud subject:payslip has:attachment is:unread",
  });
  return (res.data.messages ?? []).map((m) => m.id!);
}

export async function extractPayslipAttachment(
  messageId: string
): Promise<{ filename: string; pdfBuffer: Buffer }> {
  const gmail = getGmail();

  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const parts = msg.data.payload?.parts ?? [];
  const pdfPart = parts.find(
    (p) =>
      p.mimeType === "application/pdf" ||
      (p.filename && p.filename.endsWith(".pdf"))
  );

  if (!pdfPart?.body?.attachmentId || !pdfPart.filename) {
    throw new Error(`No PDF attachment found in message ${messageId}`);
  }

  const attachment = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: pdfPart.body.attachmentId,
  });

  // Gmail uses URL-safe base64 encoding
  const base64 = attachment.data.data!.replace(/-/g, "+").replace(/_/g, "/");
  const pdfBuffer = Buffer.from(base64, "base64");

  return { filename: pdfPart.filename, pdfBuffer };
}

export async function markAsRead(messageId: string): Promise<void> {
  const gmail = getGmail();
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}

export async function deleteEmail(messageId: string): Promise<void> {
  const gmail = getGmail();
  await gmail.users.messages.trash({
    userId: "me",
    id: messageId,
  });
}
