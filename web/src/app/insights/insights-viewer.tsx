"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { decryptJson } from "@/lib/decrypt";
import { toast } from "sonner";
import {
  ArrowLeft,
  LogOut,
  Shield,
  Lock,
  LockOpen,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  BarChart3,
  Activity,
  FileDown,
  Wallet,
  Receipt,
  Percent,
  Clock,
  ChevronDown,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { generateProofOfIncome } from "@/lib/generate-proof-of-income";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { calculateRealValue, getCumulativeInflation, loadCPIData } from "@/lib/inflation";

export interface PayslipData {
  grossPay: number;
  basicSalary: number;
  netPay: number;
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

interface EncryptedRow {
  driveFileId: string;
  payslipDate: string;
  encryptedData: string;
}

export interface DecryptedRow {
  payslipDate: string;
  data: PayslipData;
}

type ViewerState =
  | { step: "idle" }
  | { step: "loading"; progress: number; total: number }
  | { step: "ready"; rows: DecryptedRow[] }
  | { step: "error"; message: string };

type TotalsFilter = "all" | "this-year" | "last-12" | "tax-year" | "custom";

interface TotalsFilterOption {
  key: TotalsFilter;
  label: string;
}

const TOTALS_FILTERS: TotalsFilterOption[] = [
  { key: "all", label: "All Time" },
  { key: "this-year", label: "This Year" },
  { key: "last-12", label: "Last 12 Months" },
  { key: "tax-year", label: "Tax Year" },
  { key: "custom", label: "Custom Range" },
];

const AUTO_LOCK_MS = 5 * 60 * 1000;

function formatZAR(amount: number): string {
  return amount.toLocaleString("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatMonth(dateStr: string): string {
  const [year, month] = dateStr.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-ZA", {
    month: "short",
    year: "2-digit",
  });
}

const CIPHER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

function CipherText({ progress, total }: { progress: number; total: number }) {
  const [chars, setChars] = useState<string[]>([]);
  const ratio = total > 0 ? progress / total : 0;

  useEffect(() => {
    const len = 48;
    const resolved = Math.floor(ratio * len);
    const interval = setInterval(() => {
      setChars(
        Array.from({ length: len }, (_, i) => {
          if (i < resolved) return "\u00A0";
          return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
        })
      );
    }, 50);
    return () => clearInterval(interval);
  }, [ratio]);

  return (
    <div className="font-mono text-xs tracking-widest text-accent/40 select-none overflow-hidden whitespace-nowrap">
      {chars.join("")}
    </div>
  );
}

function DecryptionAnimation({
  progress,
  total,
}: {
  progress: number;
  total: number;
}) {
  const ratio = total > 0 ? progress / total : 0;
  const isAlmostDone = ratio > 0.9;
  const percentage = Math.round(ratio * 100);

  return (
    <div className="flex flex-1 flex-col items-center justify-center pt-16 animate-in fade-in duration-300">
      {/* Animated lock icon */}
      <div className="relative mb-6">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-500 ${
            isAlmostDone
              ? "border-accent bg-accent/10 scale-110"
              : "border-border bg-card"
          }`}
        >
          {isAlmostDone ? (
            <LockOpen className="size-7 text-accent animate-in zoom-in duration-300" />
          ) : (
            <Lock className="size-7 text-muted-foreground animate-pulse" />
          )}
        </div>
        {/* Pulse ring */}
        <div
          className="absolute inset-0 rounded-2xl border border-accent/20 animate-ping"
          style={{ animationDuration: "2s" }}
        />
      </div>

      {/* Status text */}
      <h2 className="font-heading text-xl font-bold text-foreground mb-1">
        {isAlmostDone ? "Almost there..." : "Decrypting payslips"}
      </h2>
      <p className="text-sm text-muted-foreground tabular-nums mb-5">
        {progress} of {total} payslips decrypted
      </p>

      {/* Cipher text lines */}
      <div className="flex flex-col gap-1.5 mb-6 w-full max-w-xs">
        <CipherText progress={progress} total={total} />
        <CipherText progress={Math.max(0, progress - 2)} total={total} />
        <CipherText progress={Math.max(0, progress - 4)} total={total} />
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{percentage}%</span>
          <span>AES-256-GCM</span>
        </div>
      </div>
    </div>
  );
}

export default function InsightsViewer() {
  const [state, setState] = useState<ViewerState>({ step: "idle" });
  const [password, setPassword] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [totalsFilter, setTotalsFilter] = useState<TotalsFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedTaxYear, setSelectedTaxYear] = useState<number | null>(null);
  const lockTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const resetLockTimer = useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      setState((s) => {
        if (s.step === "ready") {
          toast.info("Insights locked due to inactivity.");
          return { step: "idle" };
        }
        return s;
      });
    }, AUTO_LOCK_MS);
  }, []);

  useEffect(() => {
    if (state.step !== "ready") return;
    resetLockTimer();
    const events = ["mousemove", "keydown", "scroll", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, resetLockTimer);
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
      for (const e of events) window.removeEventListener(e, resetLockTimer);
    };
  }, [state.step, resetLockTimer]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const pw = password;
      setPassword("");
      setState({ step: "loading", progress: 0, total: 0 });

      try {
        const [res] = await Promise.all([
          fetch("/api/payslip-data"),
          loadCPIData(),
        ]);
        if (res.status === 401) {
          toast.error("Session expired. Please sign in again.");
          window.location.href = "/login?redirect=/insights";
          return;
        }
        if (!res.ok) throw new Error(`Failed to fetch data (${res.status})`);

        const encrypted: EncryptedRow[] = await res.json();
        setState({ step: "loading", progress: 0, total: encrypted.length });

        const decrypted: DecryptedRow[] = [];
        for (let i = 0; i < encrypted.length; i++) {
          const row = encrypted[i];
          const data = await decryptJson<PayslipData>(
            row.encryptedData,
            pw
          );
          decrypted.push({ payslipDate: row.payslipDate, data });
          setState({
            step: "loading",
            progress: i + 1,
            total: encrypted.length,
          });
        }

        // Sort by date ascending for charts
        decrypted.sort((a, b) =>
          a.payslipDate.localeCompare(b.payslipDate)
        );

        // Pre-select last 3 months for proof of income
        const last3 = decrypted.slice(-3).map((r) => r.payslipDate);
        setSelectedMonths(new Set(last3));

        setState({ step: "ready", rows: decrypted });
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "OperationError"
            ? "Wrong password. Please try again."
            : err instanceof Error
              ? err.message
              : "Decryption failed";
        setState({ step: "error", message });
        toast.error(message);
      }
    },
    [password]
  );

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };

  // Chart data
  const netPayData = useMemo(() => {
    if (state.step !== "ready" || state.rows.length === 0) return [];
    const baseMonth = state.rows[0].payslipDate;
    return state.rows.map((r) => {
      const realNet = calculateRealValue(
        r.data.netPay,
        r.payslipDate,
        baseMonth
      );
      return {
        month: formatMonth(r.payslipDate),
        netPay: r.data.netPay,
        grossPay: r.data.grossPay,
        realNetPay: realNet !== null ? Math.round(realNet) : null,
      };
    });
  }, [state]);

  const deductionData = useMemo(() => {
    if (state.step !== "ready") return [];
    return state.rows.map((r) => ({
      month: formatMonth(r.payslipDate),
      PAYE: r.data.paye,
      UIF: r.data.uif,
      Pension: r.data.pension,
      "Medical Aid": r.data.medicalAid,
      Other: r.data.otherDeductions.reduce((s, d) => s + d.amount, 0),
    }));
  }, [state]);

  const momChangeData = useMemo(() => {
    if (state.step !== "ready" || state.rows.length < 2) return [];
    return state.rows.slice(1).map((r, i) => {
      const prev = state.rows[i].data;
      const curr = r.data;
      const netChange =
        prev.netPay > 0
          ? Math.round(((curr.netPay - prev.netPay) / prev.netPay) * 1000) /
            10
          : 0;
      const grossChange =
        prev.grossPay > 0
          ? Math.round(
              ((curr.grossPay - prev.grossPay) / prev.grossPay) * 1000
            ) / 10
          : 0;
      return {
        month: formatMonth(r.payslipDate),
        "Net Pay %": netChange,
        "Gross Pay %": grossChange,
      };
    });
  }, [state]);

  // Summary stats
  const summary = useMemo(() => {
    if (state.step !== "ready" || state.rows.length === 0)
      return { latestNet: 0, avgNet: 0, months: 0, realPayChange: null as number | null, baseMonth: "" };
    const rows = state.rows;
    const latest = rows[rows.length - 1].data.netPay;
    const avg =
      rows.reduce((s, r) => s + r.data.netPay, 0) / rows.length;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const baseMonth = first.payslipDate;

    let realPayChange: number | null = null;
    if (rows.length >= 2) {
      const nominalGrowth =
        first.data.netPay > 0
          ? ((last.data.netPay - first.data.netPay) / first.data.netPay) * 100
          : null;
      const inflation = getCumulativeInflation(
        first.payslipDate,
        last.payslipDate
      );
      if (nominalGrowth !== null && inflation !== null) {
        realPayChange = Math.round((nominalGrowth - inflation) * 10) / 10;
      }
    }

    return {
      latestNet: latest,
      avgNet: Math.round(avg),
      months: rows.length,
      realPayChange,
      baseMonth: formatMonth(baseMonth),
    };
  }, [state]);

  // SA tax years: March to February (e.g. 2025 = Mar 2025 – Feb 2026)
  const availableTaxYears = useMemo(() => {
    if (state.step !== "ready") return [];
    const years = new Set<number>();
    for (const r of state.rows) {
      const [y, m] = r.payslipDate.split("-").map(Number);
      // Jan/Feb belong to the previous tax year
      years.add(m <= 2 ? y - 1 : y);
    }
    return [...years].sort((a, b) => b - a);
  }, [state]);

  // Auto-select current tax year on first click
  const currentTaxYear = useMemo(() => {
    const now = new Date();
    return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
  }, []);

  // All-Time Totals filtered rows
  const totalsRows = useMemo(() => {
    if (state.step !== "ready") return [];
    const rows = state.rows;
    if (totalsFilter === "all") return rows;
    if (totalsFilter === "this-year") {
      const year = new Date().getFullYear().toString();
      return rows.filter((r) => r.payslipDate.startsWith(year));
    }
    if (totalsFilter === "last-12") {
      const now = new Date();
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
      return rows.filter((r) => r.payslipDate >= cutoffStr);
    }
    if (totalsFilter === "tax-year") {
      const ty = selectedTaxYear ?? currentTaxYear;
      const from = `${ty}-03`;
      const to = `${ty + 1}-03`;
      return rows.filter((r) => r.payslipDate >= from && r.payslipDate < to);
    }
    // custom
    return rows.filter((r) => {
      if (customFrom && r.payslipDate < customFrom) return false;
      if (customTo && r.payslipDate > customTo) return false;
      return true;
    });
  }, [state, totalsFilter, customFrom, customTo, selectedTaxYear, currentTaxYear]);

  const totals = useMemo(() => {
    const rows = totalsRows;
    const empty = {
      gross: 0, net: 0, deductions: 0, tax: 0,
      uif: 0, pension: 0, medicalAid: 0, other: 0,
      avgTaxRate: 0, takeHomeRate: 0,
      months: 0, firstMonth: "", equivMonths: 0,
    };
    if (rows.length === 0) return empty;

    let gross = 0, net = 0, tax = 0, uif = 0, pension = 0, medicalAid = 0, other = 0;
    for (const r of rows) {
      gross += r.data.grossPay;
      net += r.data.netPay;
      tax += r.data.paye;
      uif += r.data.uif;
      pension += r.data.pension;
      medicalAid += r.data.medicalAid;
      other += r.data.otherDeductions.reduce((s, d) => s + d.amount, 0);
    }
    const deductions = gross - net;
    const avgNet = net / rows.length;

    return {
      gross, net, deductions, tax,
      uif, pension, medicalAid, other,
      avgTaxRate: gross > 0 ? (tax / gross) * 100 : 0,
      takeHomeRate: gross > 0 ? (net / gross) * 100 : 0,
      months: rows.length,
      firstMonth: rows[0].payslipDate,
      equivMonths: avgNet > 0 ? Math.round((deductions / avgNet) * 10) / 10 : 0,
    };
  }, [totalsRows]);

  const toggleMonth = useCallback((month: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }, []);

  const handleGeneratePDF = useCallback(() => {
    if (state.step !== "ready") return;
    const filtered = state.rows.filter((r) =>
      selectedMonths.has(r.payslipDate)
    );
    if (filtered.length === 0) return;
    generateProofOfIncome(filtered);
  }, [state, selectedMonths]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/history">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">History</span>
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <Shield className="size-5 text-accent" />
            <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Salary Insights
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Decryption animation */}
        {state.step === "loading" && (
          <DecryptionAnimation
            progress={state.progress}
            total={state.total}
          />
        )}

        {/* Password gate */}
        {(state.step === "idle" || state.step === "error") && (
          <div className="flex flex-1 flex-col items-center justify-center pt-16 animate-in fade-in duration-300">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
              <Lock className="size-6 text-muted-foreground" />
            </div>

            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Salary Insights
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground max-w-sm">
              Enter your vault password to decrypt and analyze your salary data.
              <br />
              Your password never leaves your browser.
            </p>

            <Card className="mt-6 w-full max-w-sm">
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (state.step === "error") setState({ step: "idle" });
                    }}
                    placeholder="Vault password"
                    required
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={!password}
                    className="w-full"
                  >
                    Decrypt & Analyze
                  </Button>
                </form>

                {state.step === "error" && (
                  <p className="mt-3 text-sm text-destructive">
                    {state.message}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts & Data */}
        {state.step === "ready" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* All-Time Totals */}
            <section className="mb-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  {totalsFilter === "all" ? "All-Time" : totalsFilter === "this-year" ? String(new Date().getFullYear()) : totalsFilter === "last-12" ? "Last 12 Months" : totalsFilter === "tax-year" ? `Tax Year ${selectedTaxYear ?? currentTaxYear}/${((selectedTaxYear ?? currentTaxYear) + 1).toString().slice(-2)}` : "Custom Range"} Totals
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {TOTALS_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setTotalsFilter(f.key)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                        totalsFilter === f.key
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-card text-muted-foreground border-border hover:border-accent/50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tax year selector */}
              {totalsFilter === "tax-year" && (
                <div className="flex items-center gap-2 mb-4">
                  <label className="text-xs text-muted-foreground">Tax Year</label>
                  <select
                    value={selectedTaxYear ?? currentTaxYear}
                    onChange={(e) => setSelectedTaxYear(Number(e.target.value))}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                  >
                    {availableTaxYears.map((y) => (
                      <option key={y} value={y}>
                        Mar {y} – Feb {y + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom range inputs */}
              {totalsFilter === "custom" && (
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">From</label>
                    <select
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                    >
                      <option value="">Earliest</option>
                      {state.step === "ready" && state.rows.map((r) => (
                        <option key={r.payslipDate} value={r.payslipDate}>
                          {formatMonth(r.payslipDate)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">To</label>
                    <select
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                    >
                      <option value="">Latest</option>
                      {state.step === "ready" && [...state.rows].reverse().map((r) => (
                        <option key={r.payslipDate} value={r.payslipDate}>
                          {formatMonth(r.payslipDate)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {totals.months === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No payslips in the selected range.
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Tracking period */}
                  <p className="text-xs text-muted-foreground mb-3">
                    Since {formatMonth(totals.firstMonth)} — {totals.months} payslip{totals.months !== 1 ? "s" : ""}
                  </p>

                  {/* Primary metrics */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
                    <Card>
                      <CardContent className="flex flex-col items-center gap-1 p-4">
                        <Wallet className="size-4 text-accent" />
                        <span className="text-lg font-bold text-foreground tabular-nums">
                          {formatZAR(totals.gross)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">Total Gross</span>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="flex flex-col items-center gap-1 p-4">
                        <DollarSign className="size-4 text-green-600" />
                        <span className="text-lg font-bold text-green-600 tabular-nums">
                          {formatZAR(totals.net)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">Total Net</span>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="flex flex-col items-center gap-1 p-4">
                        <Receipt className="size-4 text-red-500" />
                        <span className="text-lg font-bold text-red-500 tabular-nums">
                          {formatZAR(totals.deductions)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">Total Deductions</span>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="flex flex-col items-center gap-1 p-4">
                        <BarChart3 className="size-4 text-orange-500" />
                        <span className="text-lg font-bold text-orange-500 tabular-nums">
                          {formatZAR(totals.tax)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">Total Tax (PAYE)</span>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Deduction details */}
                  <Card className="mb-3">
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">Deduction Details</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                        <div>
                          <span className="text-sm font-semibold tabular-nums text-foreground">{formatZAR(totals.uif)}</span>
                          <p className="text-[11px] text-muted-foreground">UIF</p>
                        </div>
                        <div>
                          <span className="text-sm font-semibold tabular-nums text-foreground">{formatZAR(totals.pension)}</span>
                          <p className="text-[11px] text-muted-foreground">Pension</p>
                        </div>
                        <div>
                          <span className="text-sm font-semibold tabular-nums text-foreground">{formatZAR(totals.medicalAid)}</span>
                          <p className="text-[11px] text-muted-foreground">Medical Aid</p>
                        </div>
                        <div>
                          <span className="text-sm font-semibold tabular-nums text-foreground">{formatZAR(totals.other)}</span>
                          <p className="text-[11px] text-muted-foreground">Other</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Derived metrics + insight */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-3">
                    <Card>
                      <CardContent className="flex flex-col items-center gap-1 p-4">
                        <Percent className="size-4 text-accent" />
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          {totals.avgTaxRate.toFixed(1)}%
                        </span>
                        <span className="text-[11px] text-muted-foreground">Avg Tax Rate</span>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="flex flex-col items-center gap-1 p-4">
                        <Percent className="size-4 text-green-600" />
                        <span className="text-lg font-bold tabular-nums text-green-600">
                          {totals.takeHomeRate.toFixed(1)}%
                        </span>
                        <span className="text-[11px] text-muted-foreground">Take-Home Rate</span>
                      </CardContent>
                    </Card>
                    <Card className="col-span-2 sm:col-span-1">
                      <CardContent className="flex flex-col items-center gap-1 p-4">
                        <Clock className="size-4 text-muted-foreground" />
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          {totals.equivMonths}
                        </span>
                        <span className="text-[11px] text-muted-foreground text-center">Months of net salary in deductions</span>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Contextual insight */}
                  <div className="rounded-xl border border-border bg-card/50 px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      That&apos;s <span className="font-semibold text-foreground">{formatZAR(totals.deductions)}</span> you never saw — equivalent to <span className="font-semibold text-foreground">{totals.equivMonths} months</span> of your average net salary.
                    </p>
                  </div>
                </>
              )}
            </section>

            {/* Summary cards */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
                <DollarSign className="size-4 text-accent" />
                <span className="text-lg font-bold text-foreground">
                  {formatZAR(summary.latestNet)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Latest Net
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
                <Calendar className="size-4 text-accent" />
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {summary.months}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Months
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
                <BarChart3 className="size-4 text-accent" />
                <span className="text-lg font-bold text-foreground">
                  {formatZAR(summary.avgNet)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Avg Net
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
                <Activity className="size-4 text-accent" />
                <span
                  className={`text-lg font-bold tabular-nums ${
                    summary.realPayChange !== null
                      ? summary.realPayChange > 0
                        ? "text-green-600"
                        : summary.realPayChange < 0
                          ? "text-red-500"
                          : "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {summary.realPayChange !== null ? (
                    <span className="inline-flex items-center gap-1">
                      {summary.realPayChange > 0 ? (
                        <TrendingUp className="size-3" />
                      ) : summary.realPayChange < 0 ? (
                        <TrendingDown className="size-3" />
                      ) : null}
                      {summary.realPayChange > 0 ? "+" : ""}
                      {summary.realPayChange}%
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Real Pay Change
                </span>
              </div>
            </div>

            {/* Proof of Income */}
            <section className="mb-8">
              <h2 className="font-heading mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Proof of Income
              </h2>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (state.step !== "ready") return;
                        const last3 = state.rows.slice(-3).map((r) => r.payslipDate);
                        setSelectedMonths(new Set(last3));
                      }}
                    >
                      Last 3
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (state.step !== "ready") return;
                        setSelectedMonths(new Set(state.rows.map((r) => r.payslipDate)));
                      }}
                    >
                      All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMonths(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {state.step === "ready" &&
                      state.rows.map((r) => {
                        const active = selectedMonths.has(r.payslipDate);
                        return (
                          <button
                            key={r.payslipDate}
                            onClick={() => toggleMonth(r.payslipDate)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                              active
                                ? "bg-accent text-accent-foreground border-accent"
                                : "bg-card text-muted-foreground border-border hover:border-accent/50"
                            }`}
                          >
                            {formatMonth(r.payslipDate)}
                          </button>
                        );
                      })}
                  </div>
                  <Button
                    onClick={handleGeneratePDF}
                    disabled={selectedMonths.size === 0}
                    className="gap-2"
                  >
                    <FileDown className="size-4" />
                    Generate PDF
                    {selectedMonths.size > 0 && (
                      <span className="text-xs opacity-70">
                        ({selectedMonths.size} month{selectedMonths.size !== 1 ? "s" : ""})
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </section>

            {/* Net Pay trend */}
            <section className="mb-8">
              <h2 className="font-heading mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Pay Trend
              </h2>
              <Card>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={netPayData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                        tickFormatter={(v) =>
                          `R${(v / 1000).toFixed(0)}k`
                        }
                      />
                      <Tooltip
                        formatter={(value) => formatZAR(value as number)}
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="grossPay"
                        name="Gross Pay"
                        stroke="var(--color-accent)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="netPay"
                        name="Net Pay"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="realNetPay"
                        name="Real Net Pay"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={{ r: 2 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>

            {/* Deduction breakdown */}
            <section className="mb-8">
              <h2 className="font-heading mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Deduction Breakdown
              </h2>
              <Card>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={deductionData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                        tickFormatter={(v) =>
                          `R${(v / 1000).toFixed(0)}k`
                        }
                      />
                      <Tooltip
                        formatter={(value) => formatZAR(value as number)}
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="PAYE"
                        stackId="deductions"
                        fill="#ef4444"
                      />
                      <Bar
                        dataKey="UIF"
                        stackId="deductions"
                        fill="#f97316"
                      />
                      <Bar
                        dataKey="Pension"
                        stackId="deductions"
                        fill="#eab308"
                      />
                      <Bar
                        dataKey="Medical Aid"
                        stackId="deductions"
                        fill="#22c55e"
                      />
                      <Bar
                        dataKey="Other"
                        stackId="deductions"
                        fill="#6366f1"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </section>

            {/* Month-over-month changes */}
            {momChangeData.length > 0 && (
              <section className="mb-8">
                <h2 className="font-heading mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Month-over-Month Change
                </h2>
                <Card>
                  <CardContent className="pt-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={momChangeData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12 }}
                          stroke="var(--color-muted-foreground)"
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          stroke="var(--color-muted-foreground)"
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          formatter={(value) => `${value}%`}
                          contentStyle={{
                            backgroundColor: "var(--color-card)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "8px",
                            fontSize: "13px",
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="Net Pay %"
                          fill="var(--color-primary)"
                        />
                        <Bar
                          dataKey="Gross Pay %"
                          fill="var(--color-accent)"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Detailed table */}
            <section>
              <h2 className="font-heading mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Monthly Detail
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Month</th>
                          <th className="px-4 py-3 font-medium text-right">
                            Gross
                          </th>
                          <th className="px-4 py-3 font-medium text-right">
                            Deductions
                          </th>
                          <th className="px-4 py-3 font-medium text-right">
                            Net
                          </th>
                          <th className="px-4 py-3 font-medium text-right">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...state.rows].reverse().map((row, i, arr) => {
                          const prev =
                            i < arr.length - 1 ? arr[i + 1].data : null;
                          const pctChange =
                            prev && prev.netPay > 0
                              ? Math.round(
                                  ((row.data.netPay - prev.netPay) /
                                    prev.netPay) *
                                    1000
                                ) / 10
                              : null;
                          return (
                            <tr
                              key={row.payslipDate}
                              className="border-b border-border last:border-0"
                            >
                              <td className="px-4 py-3 font-medium">
                                {formatMonth(row.payslipDate)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {formatZAR(row.data.grossPay)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {formatZAR(row.data.totalDeductions)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium">
                                {formatZAR(row.data.netPay)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {pctChange !== null ? (
                                  <span
                                    className={`inline-flex items-center gap-1 ${pctChange > 0 ? "text-green-600" : pctChange < 0 ? "text-red-500" : "text-muted-foreground"}`}
                                  >
                                    {pctChange > 0 ? (
                                      <TrendingUp className="size-3" />
                                    ) : pctChange < 0 ? (
                                      <TrendingDown className="size-3" />
                                    ) : null}
                                    {pctChange > 0 ? "+" : ""}
                                    {pctChange}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Footer */}
            <div className="mt-10 border-t border-border pt-6 text-center space-y-1">
              <p className="text-xs text-muted-foreground">
                Real pay adjusted for SA CPI inflation (FRED ZAFCPIALLMINMEI). Base: {summary.baseMonth || "N/A"}.
              </p>
              <p className="text-xs text-muted-foreground">
                All data decrypted locally in your browser. Auto-locks after 5
                minutes of inactivity.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
