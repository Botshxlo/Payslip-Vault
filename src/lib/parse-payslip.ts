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
 * Parse a single payslip block from raw text lines.
 */
function parseSinglePayslip(lines: string[]): PayslipData {
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

  type Section = "none" | "income" | "allowance" | "deduction" | "employer" | "benefit";
  let section: Section = "none";

  for (const line of lines) {
    // Detect section headers — pdf-parse v1 may jam label+amounts together
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

    if (/NETT\s*PAY/i.test(line)) {
      netPay = extractCurrentAmount(line);
      break;
    }

    // Skip section dividers like "CurrentYTD"
    if (/^Current\s*YTD$/i.test(line)) continue;

    const amount = extractCurrentAmount(line);
    if (amount === 0) continue;

    const label = line.replace(/\s*-?[\d,]+\.\d{2}.*$/, "").trim();

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

/**
 * Merge multiple PayslipData objects by summing numeric fields
 * and concatenating array fields (deduping by name, summing amounts).
 */
function mergePayslips(payslips: PayslipData[]): PayslipData {
  if (payslips.length === 1) return payslips[0];

  const merged: PayslipData = {
    grossPay: 0,
    basicSalary: 0,
    netPay: 0,
    paye: 0,
    uif: 0,
    pension: 0,
    medicalAid: 0,
    otherDeductions: [],
    totalDeductions: 0,
    allowances: [],
    benefits: [],
  };

  let bonus = 0;
  let overtime = 0;

  for (const p of payslips) {
    merged.grossPay += p.grossPay;
    merged.basicSalary += p.basicSalary;
    merged.netPay += p.netPay;
    merged.paye += p.paye;
    merged.uif += p.uif;
    merged.pension += p.pension;
    merged.medicalAid += p.medicalAid;
    merged.totalDeductions += p.totalDeductions;
    bonus += p.bonus ?? 0;
    overtime += p.overtime ?? 0;

    // Merge named items by summing amounts for same name
    for (const d of p.otherDeductions) {
      const existing = merged.otherDeductions.find((e) => e.name === d.name);
      if (existing) existing.amount += d.amount;
      else merged.otherDeductions.push({ ...d });
    }
    for (const a of p.allowances) {
      const existing = merged.allowances.find((e) => e.name === a.name);
      if (existing) existing.amount += a.amount;
      else merged.allowances.push({ ...a });
    }
    for (const b of p.benefits) {
      const existing = merged.benefits.find((e) => e.name === b.name);
      if (existing) existing.amount += b.amount;
      else merged.benefits.push({ ...b });
    }
  }

  if (bonus) merged.bonus = bonus;
  if (overtime) merged.overtime = overtime;

  // Round to 2dp to avoid floating point drift
  const r = (n: number) => Math.round(n * 100) / 100;
  merged.grossPay = r(merged.grossPay);
  merged.basicSalary = r(merged.basicSalary);
  merged.netPay = r(merged.netPay);
  merged.paye = r(merged.paye);
  merged.uif = r(merged.uif);
  merged.pension = r(merged.pension);
  merged.medicalAid = r(merged.medicalAid);
  merged.totalDeductions = r(merged.totalDeductions);

  return merged;
}

/**
 * Parse structured payslip data from raw PDF text.
 * Supports merged PDFs containing multiple payslips — splits on
 * NETT PAY boundaries and sums the results.
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

  // Split into blocks — each block ends at a NETT PAY line
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    current.push(line);
    if (/NETT\s*PAY/i.test(line)) {
      blocks.push(current);
      current = [];
    }
  }

  // If no NETT PAY found, treat entire text as one block
  if (blocks.length === 0 && current.length > 0) {
    blocks.push(current);
  }

  const payslips = blocks.map(parseSinglePayslip);
  return mergePayslips(payslips);
}
