import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { createClient } from "@libsql/client";

export const auth = betterAuth({
  database: {
    db: createClient({
      url: process.env.TURSO_DATABASE_URL || "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
    type: "sqlite",
  },
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  plugins: [nextCookies()],
  secret: process.env.BETTER_AUTH_SECRET || "build-placeholder-secret-not-used-at-runtime",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
          if (user.email?.toLowerCase() !== allowed) {
            return false;
          }
          return true;
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
