import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function getTurso(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}
