/**
 * FRED API client for fetching SA CPI data (series ZAFCPIALLMINMEI).
 */

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const SERIES_ID = "ZAFCPIALLMINMEI";

export interface CPIObservation {
  month: string; // YYYY-MM
  value: number;
}

/**
 * Fetches SA CPI observations from FRED for the last 24 months.
 */
export async function fetchSACPI(): Promise<CPIObservation[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error("FRED_API_KEY is not set");

  // Fetch last 24 months of data
  const since = new Date();
  since.setMonth(since.getMonth() - 24);
  const startDate = since.toISOString().slice(0, 10);

  const url = new URL(FRED_BASE);
  url.searchParams.set("series_id", SERIES_ID);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", startDate);
  url.searchParams.set("sort_order", "asc");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FRED API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    observations: { date: string; value: string }[];
  };

  return data.observations
    .filter((obs) => obs.value !== ".")
    .map((obs) => ({
      month: obs.date.slice(0, 7), // "2024-01-01" → "2024-01"
      value: parseFloat(obs.value),
    }));
}
