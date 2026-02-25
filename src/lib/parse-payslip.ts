import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

// Re-export from parsers for backwards compatibility
export { parsePayslipData } from "./parsers/index.js";
export type { PayslipData } from "./parsers/types.js";

/**
 * Extract raw text from an unlocked PDF buffer using pdf-parse.
 */
export async function extractPayslipText(
  pdfBuffer: Buffer
): Promise<string> {
  const result = await pdfParse(pdfBuffer);
  return result.text;
}
