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
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  BarChart3,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
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

interface PayslipData {
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

interface DecryptedRow {
  payslipDate: string;
  data: PayslipData;
}

type ViewerState =
  | { step: "idle" }
  | { step: "loading"; progress: number; total: number }
  | { step: "ready"; rows: DecryptedRow[] }
  | { step: "error"; message: string };

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

export default function InsightsViewer() {
  const [state, setState] = useState<ViewerState>({ step: "idle" });
  const [password, setPassword] = useState("");
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
        const res = await fetch("/api/payslip-data");
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
    []
  );

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };

  // Chart data
  const netPayData = useMemo(() => {
    if (state.step !== "ready") return [];
    return state.rows.map((r) => ({
      month: formatMonth(r.payslipDate),
      netPay: r.data.netPay,
      grossPay: r.data.grossPay,
    }));
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
      return { latestNet: 0, avgNet: 0, months: 0 };
    const latest = state.rows[state.rows.length - 1].data.netPay;
    const avg =
      state.rows.reduce((s, r) => s + r.data.netPay, 0) / state.rows.length;
    return {
      latestNet: latest,
      avgNet: Math.round(avg),
      months: state.rows.length,
    };
  }, [state]);

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
        {/* Password gate */}
        {state.step !== "ready" && (
          <div className="flex flex-1 flex-col items-center justify-center pt-16">
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
                    disabled={state.step === "loading"}
                  />
                  <Button
                    type="submit"
                    disabled={state.step === "loading" || !password}
                    className="w-full"
                  >
                    {state.step === "loading" ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="size-4 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Decrypting {state.progress}/{state.total}...
                      </span>
                    ) : (
                      "Decrypt & Analyze"
                    )}
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
          <>
            {/* Summary cards */}
            <div className="mb-8 grid grid-cols-3 gap-3">
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
            </div>

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
            <div className="mt-10 border-t border-border pt-6 text-center">
              <p className="text-xs text-muted-foreground">
                All data decrypted locally in your browser. Auto-locks after 5
                minutes of inactivity.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
