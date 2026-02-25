/**
 * Generates a Google OAuth2 refresh token for Gmail + Drive access.
 * Usage: npx tsx scripts/get-token.ts
 *
 * 1. Opens an auth URL — paste it in your browser
 * 2. Starts a local server on port 3000 to catch the callback
 * 3. Prints the refresh token to use in .env
 */

import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { createServer } from "node:http";
import { OAuth2Client } from "google-auth-library";

loadEnvFile(join(import.meta.dirname!, "..", ".env"));

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000/oauth/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first");
  process.exit(1);
}

const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/drive.file",
  ],
  prompt: "consent",
});

console.log("\nOpen this URL in your browser:\n");
console.log(authUrl);
console.log("\nWaiting for callback on http://localhost:3000 ...\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, "http://localhost:3000");

  if (url.pathname !== "/oauth/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("Missing code parameter");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Success! You can close this tab.</h1>");

    console.log("=== Tokens received ===\n");
    console.log(`REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log("Update this in:");
    console.log("  1. .env → GMAIL_REFRESH_TOKEN and GOOGLE_REFRESH_TOKEN");
    console.log("  2. web/.env.local → GOOGLE_REFRESH_TOKEN");
    console.log("  3. Trigger.dev dashboard → GOOGLE_REFRESH_TOKEN");
  } catch (err) {
    res.writeHead(500);
    res.end("Token exchange failed");
    console.error("Token exchange failed:", err);
  }

  server.close();
});

server.listen(3000);
