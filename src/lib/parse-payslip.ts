import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

export interface PayslipData {
  grossPay: number;
  netPay: number;
  basicSalary: number;
  paye: number;
  uif: number;
  pension: number;
  medicalAid: number;
  otherDeductions: { name: string; amount: number }[];
  totalDeductions: number;
  allowances: { name: string; amount: number }[];
  benefits: { name: string; amount: number }[];
  bonus?: number;
  overtime?: number;
}

/**
 * Extract raw text from an unlocked PDF buffer using pdf-parse.
 */
export async function extractPayslipText(
  pdfBuffer: Buffer
): Promise<string> {
  const result = await pdfParse(pdfBuffer);
  return result.text;
}

/**
 * Parse a rand amount string like "R 12,345.67" or "12,345.67" to a number.
 */
function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[R\s,]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract the "Current" column amount from a line like:
 *   "Basic Salary28,636.3628,636.36"  (pdf-parse v1 — no spaces)
 *   "Basic Salary 28,636.36 28,636.36" (pdf-parse v2 — with spaces)
 *   "NETT PAY R 23,112.81"
 *
 * SimplePay format: lines with two amounts have [Current] [YTD].
 * We want the first (Current) amount.
 */
function extractCurrentAmount(line: string): number {
  // NETT PAY has "R" prefix — special case
  const nettMatch = line.match(/NETT\s*PAY\s*R\s*([\d,]+\.\d{2})/i);
  if (nettMatch) return parseAmount(nettMatch[1]);

  // Two amounts (possibly jammed together without spaces): "Label28,636.3628,636.36"
  const twoAmounts = line.match(/([\d,]+\.\d{2})\s*([\d,]+\.\d{2})\s*$/);
  if (twoAmounts) return parseAmount(twoAmounts[1]);

  // Lines with one amount
  const oneAmount = line.match(/([\d,]+\.\d{2})\s*$/);
  if (oneAmount) return parseAmount(oneAmount[1]);

  return 0;
}

/**
 * Parse structured payslip data from raw PDF text.
 *
 * SimplePay (South Africa) payslip format:
 *   Income [Current] [YTD]         ← total income (gross)
 *   Basic Salary [Current] [YTD]
 *   Allowance [Current] [YTD]      ← total allowances (optional)
 *   [Allowance Name] [Current] [YTD]
 *   Deduction [Current] [YTD]      ← total deductions
 *   UIF - Employee [Current] [YTD]
 *   Tax (PAYE) [Current] [YTD]
 *   Employer Contribution ...
 *   Benefit ...
 *   NETT PAY R xx,xxx.xx
 */
export function parsePayslipData(text: string): PayslipData {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let grossPay = 0;
  let basicSalary = 0;
  let netPay = 0;
  let paye = 0;
  let uif = 0;
  let pension = 0;
  let medicalAid = 0;
  let totalDeductions = 0;
  let bonus = 0;
  let overtime = 0;
  const otherDeductions: { name: string; amount: number }[] = [];
  const allowances: { name: string; amount: number }[] = [];
  const benefits: { name: string; amount: number }[] = [];

  // Track which section we're in
  type Section = "none" | "income" | "allowance" | "deduction" | "employer" | "benefit";
  let section: Section = "none";

  for (const line of lines) {
    // Detect section headers — pdf-parse v1 may jam label+amounts together
    // e.g. "Income28,636.3628,636.36" or "Income 28,636.36 28,636.36"
    if (/^Income[\s\d]/i.test(line) && /\d/.test(line)) {
      grossPay = extractCurrentAmount(line);
      section = "income";
      continue;
    }
    if (/^Allowance[\s\d]/i.test(line) && /\d/.test(line)) {
      section = "allowance";
      continue;
    }
    if (/^Deduction[\s\d]/i.test(line) && /\d/.test(line)) {
      totalDeductions = extractCurrentAmount(line);
      section = "deduction";
      continue;
    }
    if (/^Employer\s*Contribution/i.test(line)) {
      section = "employer";
      continue;
    }
    if (/^Benefit[\s\d]/i.test(line) && /\d/.test(line)) {
      section = "benefit";
      continue;
    }

    // NETT PAY line ends the payslip data
    if (/NETT\s*PAY/i.test(line)) {
      netPay = extractCurrentAmount(line);
      break;
    }

    // Skip section dividers like "Current YTD" or "CurrentYTD"
    if (/^Current\s*YTD$/i.test(line)) continue;

    const amount = extractCurrentAmount(line);
    if (amount === 0) continue;

    // Extract the label (text before the amounts — may have no space before digits)
    const label = line.replace(/\s*[\d,]+\.\d{2}.*$/, "").trim();

    switch (section) {
      case "income":
        if (/basic\s*salary/i.test(label)) {
          basicSalary = amount;
        } else if (/bonus/i.test(label)) {
          bonus = amount;
        } else if (/overtime/i.test(label)) {
          overtime = amount;
        }
        break;

      case "allowance":
        allowances.push({ name: label, amount });
        break;

      case "deduction":
        if (/uif/i.test(label)) {
          uif = amount;
        } else if (/paye|tax\b/i.test(label)) {
          paye = amount;
        } else if (/pension|provident|retirement/i.test(label)) {
          pension = amount;
        } else if (/medical/i.test(label)) {
          medicalAid = amount;
        } else if (label) {
          otherDeductions.push({ name: label, amount });
        }
        break;

      case "benefit":
        benefits.push({ name: label, amount });
        break;
    }
  }

  return {
    grossPay,
    basicSalary,
    netPay,
    paye,
    uif,
    pension,
    medicalAid,
    otherDeductions,
    totalDeductions:
      totalDeductions ||
      paye + uif + pension + medicalAid +
        otherDeductions.reduce((s, d) => s + d.amount, 0),
    allowances,
    benefits,
    ...(bonus ? { bonus } : {}),
    ...(overtime ? { overtime } : {}),
  };
}
