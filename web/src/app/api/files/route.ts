import { NextResponse } from "next/server";
import { drive_v3 } from "@googleapis/drive";
import { OAuth2Client } from "google-auth-library";

function getAuth(): OAuth2Client {
  const auth = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

export async function GET() {
  try {
    const drive = new drive_v3.Drive({ auth: getAuth() });

    const folderRes = await drive.files.list({
      q: "name='Payslip Vault' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id)",
      spaces: "drive",
    });

    const folderId = folderRes.data.files?.[0]?.id;
    if (!folderId) {
      return NextResponse.json([]);
    }

    const filesRes = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name,createdTime)",
      orderBy: "createdTime desc",
    });

    return NextResponse.json(filesRes.data.files ?? []);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to list files";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
