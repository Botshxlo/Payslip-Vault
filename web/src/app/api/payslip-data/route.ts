import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { createClient } from "@libsql/client";

function getTurso() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const client = getTurso();
    const result = await client.execute(
      "SELECT drive_file_id, payslip_date, encrypted_data FROM payslip_data ORDER BY payslip_date ASC"
    );

    const rows = result.rows.map((row) => ({
      driveFileId: row.drive_file_id as string,
      payslipDate: row.payslip_date as string,
      encryptedData: row.encrypted_data as string,
    }));

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Failed to fetch payslip data:", err);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
