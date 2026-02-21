import { defineConfig } from "@trigger.dev/sdk/v3";
import { aptGet, additionalPackages } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_nyvrmpbepxfkjcuzmirx",
  dirs: ["./src/trigger"],
  maxDuration: 300, // 5 minutes max per task run
  build: {
    external: ["pdf-parse", "@libsql/client", "@libsql/linux-x64-gnu"],
    extensions: [
      aptGet({ packages: ["qpdf"] }),
      additionalPackages({ packages: ["pdf-parse", "@libsql/client"] }),
    ],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      factor: 2,
    },
  },
});
