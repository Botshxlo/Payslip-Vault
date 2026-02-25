import type { PayslipData } from "./types.js";
import { simplePayParser } from "./simplepay.js";

const parsers = [simplePayParser];

/**
 * Parse structured payslip data from raw PDF text.
 * Tries each registered parser's detect() method in order.
 * Falls back to SimplePay if no parser matches.
 */
export function parsePayslipData(text: string): PayslipData {
  for (const parser of parsers) {
    if (parser.detect(text)) {
      return parser.parse(text);
    }
  }

  // Fallback to SimplePay
  return simplePayParser.parse(text);
}

export type { PayslipData, PayslipParser } from "./types.js";
