// Types
export interface WealthConfig {
  startingBalance: number;
  monthlyDeposit: number;
  annualRate: number; // e.g. 7.25 for 7.25%
  monthlyExpenses: number;
  netSalary: number;
  startMonth: string; // "YYYY-MM"
  propertyEnabled: boolean;
  propertyAmount: number;
  propertyMonth: number; // 0-based month index from startMonth
}

export interface MonthProjection {
  month: string; // "YYYY-MM"
  label: string; // "Mar 26" format
  openingBalance: number;
  deposit: number;
  interest: number;
  closingBalance: number;
  floatIncome: number;
  milestoneReached?: string; // milestone label if crossed this month
}

export interface Milestone {
  id: string;
  label: string;
  targetAmount: number;
  enabled: boolean;
}

// Default config matching the user's actual financial situation
export const DEFAULT_CONFIG: WealthConfig = {
  startingBalance: 352500,
  monthlyDeposit: 27500,
  annualRate: 7.25,
  monthlyExpenses: 3878,
  netSalary: 35072,
  startMonth: "2026-03",
  propertyEnabled: false,
  propertyAmount: 665900,
  propertyMonth: 14, // May 2027 (14 months from Mar 2026)
};

export const DEFAULT_MILESTONES: Milestone[] = [
  { id: "600k", label: "End of Year Goal", targetAmount: 600000, enabled: true },
  { id: "700k", label: "Property Ready", targetAmount: 700000, enabled: true },
  { id: "1m", label: "Millionaire", targetAmount: 1000000, enabled: true },
  {
    id: "1.65m",
    label: "Live Off Interest (R10k/mo)",
    targetAmount: 1650000,
    enabled: true,
  },
  {
    id: "2m",
    label: "Live Off Interest (R12k/mo)",
    targetAmount: 2000000,
    enabled: true,
  },
];

/**
 * Add N months to a "YYYY-MM" string, returns "YYYY-MM".
 */
export function addMonth(month: string, offset: number): string {
  const [year, mon] = month.split("-").map(Number);
  const totalMonths = year * 12 + (mon - 1) + offset;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/**
 * Converts "2026-03" to "Mar 26" format.
 */
export function formatMonthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(year, mon - 1, 1);
  const monthName = date.toLocaleString("en-US", { month: "short" });
  const shortYear = String(year).slice(-2);
  return `${monthName} ${shortYear}`;
}

/**
 * Generate month-by-month wealth projections.
 *
 * Key model: interest is NOT reinvested. It is paid out monthly as spending
 * money (float income). Only the monthly deposit grows the investment balance.
 * closingBalance = openingBalance + deposit (minus property deduction if applicable).
 */
export function generateProjections(
  config: WealthConfig,
  numMonths: number = 48
): MonthProjection[] {
  const {
    startingBalance,
    monthlyDeposit,
    annualRate,
    monthlyExpenses,
    netSalary,
    startMonth,
    propertyEnabled,
    propertyAmount,
    propertyMonth,
  } = config;

  const monthlyRate = annualRate / 100 / 12;
  const projections: MonthProjection[] = [];
  const reachedMilestones = new Set<string>();

  for (let i = 0; i < numMonths; i++) {
    const month = addMonth(startMonth, i);
    const label = formatMonthLabel(month);
    const openingBalance =
      i === 0 ? startingBalance : projections[i - 1].closingBalance;

    const interest = openingBalance * monthlyRate;
    const deposit = monthlyDeposit;
    let closingBalance = openingBalance + deposit;

    if (propertyEnabled && i === propertyMonth) {
      closingBalance -= propertyAmount;
    }

    const floatIncome = netSalary - monthlyExpenses - monthlyDeposit + interest;

    // Check milestones
    let milestoneReached: string | undefined;
    const previousBalance =
      i === 0 ? startingBalance : projections[i - 1].closingBalance;

    for (const milestone of DEFAULT_MILESTONES) {
      if (
        milestone.enabled &&
        !reachedMilestones.has(milestone.id) &&
        closingBalance >= milestone.targetAmount &&
        previousBalance < milestone.targetAmount
      ) {
        milestoneReached = milestone.label;
        reachedMilestones.add(milestone.id);
        break;
      }
    }

    projections.push({
      month,
      label,
      openingBalance,
      deposit,
      interest,
      closingBalance,
      floatIncome,
      ...(milestoneReached ? { milestoneReached } : {}),
    });
  }

  return projections;
}

/**
 * Returns the month string when balance first reaches targetAmount, or null.
 */
export function findMilestoneMonth(
  projections: MonthProjection[],
  targetAmount: number
): string | null {
  for (const p of projections) {
    if (p.closingBalance >= targetAmount) {
      return p.month;
    }
  }
  return null;
}

/**
 * Calculate the balance needed to generate a target monthly interest payout.
 * Formula: targetMonthlyInterest / (annualRate / 100 / 12)
 */
export function calcRequiredBalance(
  targetMonthlyInterest: number,
  annualRate: number
): number {
  return targetMonthlyInterest / (annualRate / 100 / 12);
}

/**
 * Generate projections until balance >= target, return month count.
 * Capped at 240 months (20 years) to prevent infinite loops.
 */
export function calcMonthsToTarget(
  config: WealthConfig,
  targetAmount: number
): number {
  const maxMonths = 240;
  const monthlyRate = config.annualRate / 100 / 12;
  let balance = config.startingBalance;

  for (let i = 0; i < maxMonths; i++) {
    balance += config.monthlyDeposit;

    if (config.propertyEnabled && i === config.propertyMonth) {
      balance -= config.propertyAmount;
    }

    if (balance >= targetAmount) {
      return i + 1;
    }
  }

  return maxMonths;
}

/**
 * Format a number as South African Rand with no decimal places.
 */
export function formatZAR(amount: number): string {
  return amount.toLocaleString("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
