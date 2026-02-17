import { defineConfig } from "@trigger.dev/sdk/v3";
import { aptGet } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_nyvrmpbepxfkjcuzmirx",
  dirs: ["./src/trigger"],
  maxDuration: 300, // 5 minutes max per task run
  build: {
    extensions: [aptGet({ packages: ["qpdf"] })],
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
