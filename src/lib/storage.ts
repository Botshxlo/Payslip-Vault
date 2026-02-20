import { drive_v3 } from "@googleapis/drive";
import { OAuth2Client } from "google-auth-library";
import { Readable } from "node:stream";

function getAuth(): OAuth2Client {
  const auth = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

function getDrive() {
  return new drive_v3.Drive({ auth: getAuth() });
}

let vaultFolderId: string | null = null;

async function getOrCreateVaultFolder(
  drive: drive_v3.Drive
): Promise<string> {
  if (vaultFolderId) return vaultFolderId;

  const res = await drive.files.list({
    q: "name='Payslip Vault' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id)",
    spaces: "drive",
  });

  if (res.data.files && res.data.files.length > 0) {
    vaultFolderId = res.data.files[0].id!;
    return vaultFolderId;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: "Payslip Vault",
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  vaultFolderId = folder.data.id!;
  return vaultFolderId;
}

export async function payslipExists(baseName: string): Promise<boolean> {
  const drive = getDrive();
  const folderId = await getOrCreateVaultFolder(drive);

  // baseName is e.g. "Payslip 2025-11-30" — search for files starting with it
  const escaped = baseName.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '${escaped}' and trashed=false`,
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 1,
  });

  return (res.data.files?.length ?? 0) > 0;
}

export async function uploadToGoogleDrive(
  data: Buffer,
  filename: string
): Promise<drive_v3.Schema$File> {
  const drive = getDrive();
  const folderId = await getOrCreateVaultFolder(drive);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: "application/octet-stream",
      body: Readable.from(data),
    },
    fields: "id,name",
  });

  return res.data;
}
