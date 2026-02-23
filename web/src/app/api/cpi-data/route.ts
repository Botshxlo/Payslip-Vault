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
      "SELECT month, value FROM cpi_data ORDER BY month ASC"
    );

    const cpiMap: Record<string, number> = {};
    for (const row of result.rows) {
      cpiMap[row.month as string] = row.value as number;
    }

    return NextResponse.json(cpiMap, {
      headers: {
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    console.error("Failed to fetch CPI data:", err);
    return NextResponse.json(
      { error: "Failed to fetch CPI data" },
      { status: 500 }
    );
  }
}
