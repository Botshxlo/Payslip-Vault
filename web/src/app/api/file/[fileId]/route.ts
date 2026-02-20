import { NextRequest, NextResponse } from "next/server";
import { drive_v3 } from "@googleapis/drive";
import { OAuth2Client } from "google-auth-library";
import { requireAuth } from "@/lib/auth-utils";

function getAuth(): OAuth2Client {
  const auth = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { fileId } = await params;

  try {
    const drive = new drive_v3.Drive({ auth: getAuth() });

    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    return new NextResponse(res.data as ArrayBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch file";
    const status = message.includes("notFound") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
