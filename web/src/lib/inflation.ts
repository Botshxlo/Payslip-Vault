let cpiMap: Record<string, number> = {};
let sortedMonths: string[] = [];

/**
 * Fetch CPI data from the API and populate the module-level map.
 * Must be called before using getLatestCPI / calculateRealValue / getCumulativeInflation.
 * If the API call fails, CPI functions will return null (no data available).
 */
export async function loadCPIData(): Promise<void> {
  try {
    const res = await fetch("/api/cpi-data");
    if (!res.ok) return;
    const data: Record<string, number> = await res.json();
    if (Object.keys(data).length > 0) {
      cpiMap = data;
      sortedMonths = Object.keys(cpiMap).sort();
    }
  } catch {
    // CPI functions will return null if data couldn't be loaded
  }
}

/**
 * Get the CPI value for a given month (YYYY-MM).
 * Falls back to the latest available value before that month.
 */
export function getLatestCPI(month: string): number | null {
  if (cpiMap[month] !== undefined) return cpiMap[month];

  // Find the latest month that is <= the requested month
  let fallback: string | null = null;
  for (const m of sortedMonths) {
    if (m <= month) fallback = m;
    else break;
  }
  return fallback ? cpiMap[fallback] : null;
}

/**
 * Adjust a nominal value to real terms.
 * Returns nominal * (baseCPI / currentCPI).
 */
export function calculateRealValue(
  nominal: number,
  currentMonth: string,
  baseMonth: string
): number | null {
  const baseCPI = getLatestCPI(baseMonth);
  const currentCPI = getLatestCPI(currentMonth);
  if (baseCPI === null || currentCPI === null || currentCPI === 0) return null;
  return nominal * (baseCPI / currentCPI);
}

/**
 * Get cumulative inflation between two months as a percentage.
 * Returns ((endCPI - startCPI) / startCPI) * 100.
 */
export function getCumulativeInflation(
  startMonth: string,
  endMonth: string
): number | null {
  const startCPI = getLatestCPI(startMonth);
  const endCPI = getLatestCPI(endMonth);
  if (startCPI === null || endCPI === null || startCPI === 0) return null;
  return ((endCPI - startCPI) / startCPI) * 100;
}
