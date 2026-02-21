import type { PayslipData } from "./parse-payslip.js";

export interface PayslipChange {
  field: string;
  previousAmount: number;
  currentAmount: number;
  percentChange: number;
  type: "increased" | "decreased" | "new" | "removed";
}

/**
 * Compare two payslip months and return meaningful changes.
 * Only returns changes where the percentage difference is >= 0.5% to filter noise.
 */
export function detectChanges(
  current: PayslipData,
  previous: PayslipData
): PayslipChange[] {
  const changes: PayslipChange[] = [];
  const threshold = 0.5; // minimum % change to report

  const fields: { key: keyof PayslipData; label: string }[] = [
    { key: "grossPay", label: "Gross Pay" },
    { key: "basicSalary", label: "Basic Salary" },
    { key: "netPay", label: "Net Pay" },
    { key: "paye", label: "PAYE" },
    { key: "uif", label: "UIF" },
    { key: "pension", label: "Pension" },
    { key: "medicalAid", label: "Medical Aid" },
    { key: "totalDeductions", label: "Total Deductions" },
    { key: "bonus", label: "Bonus" },
    { key: "overtime", label: "Overtime" },
  ];

  for (const { key, label } of fields) {
    const curr = (current[key] as number | undefined) ?? 0;
    const prev = (previous[key] as number | undefined) ?? 0;

    if (curr === 0 && prev === 0) continue;

    if (prev === 0 && curr > 0) {
      changes.push({
        field: label,
        previousAmount: 0,
        currentAmount: curr,
        percentChange: 100,
        type: "new",
      });
      continue;
    }

    if (curr === 0 && prev > 0) {
      changes.push({
        field: label,
        previousAmount: prev,
        currentAmount: 0,
        percentChange: -100,
        type: "removed",
      });
      continue;
    }

    const pctChange = ((curr - prev) / prev) * 100;
    if (Math.abs(pctChange) >= threshold) {
      changes.push({
        field: label,
        previousAmount: prev,
        currentAmount: curr,
        percentChange: Math.round(pctChange * 10) / 10,
        type: pctChange > 0 ? "increased" : "decreased",
      });
    }
  }

  // Check other deductions for new/removed items
  const prevOtherNames = new Set(
    previous.otherDeductions.map((d) => d.name)
  );
  const currOtherNames = new Set(
    current.otherDeductions.map((d) => d.name)
  );

  for (const d of current.otherDeductions) {
    if (!prevOtherNames.has(d.name)) {
      changes.push({
        field: d.name,
        previousAmount: 0,
        currentAmount: d.amount,
        percentChange: 100,
        type: "new",
      });
    }
  }

  for (const d of previous.otherDeductions) {
    if (!currOtherNames.has(d.name)) {
      changes.push({
        field: d.name,
        previousAmount: d.amount,
        currentAmount: 0,
        percentChange: -100,
        type: "removed",
      });
    }
  }

  return changes;
}
