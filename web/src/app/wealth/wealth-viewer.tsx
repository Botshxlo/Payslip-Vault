"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  type WealthConfig,
  type MonthProjection,
  type Milestone,
  DEFAULT_CONFIG,
  DEFAULT_MILESTONES,
  generateProjections,
  findMilestoneMonth,
  calcRequiredBalance,
  calcMonthsToTarget,
  formatZAR,
  formatMonthLabel,
  addMonth,
} from "@/lib/wealth";
import {
  ArrowLeft,
  LogOut,
  TrendingUp,
  Landmark,
  Target,
  Calculator,
  Wallet,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Banknote,
  PiggyBank,
  Home,
  Settings,
  RotateCcw,
} from "lucide-react";
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
  ReferenceLine,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "13px",
};

function SectionHeader({ title, id }: { title: string; id?: string }) {
  return (
    <div
      id={id}
      className="mt-10 mb-4 border-t border-border pt-6 first:mt-0 first:border-0 first:pt-0"
    >
      <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
    </div>
  );
}

export default function WealthViewer() {
  // ── State ──
  const [config, setConfig] = useState<WealthConfig>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("wealth-config");
      if (saved) return JSON.parse(saved);
    }
    return DEFAULT_CONFIG;
  });

  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("wealth-milestones");
      if (saved) return JSON.parse(saved);
    }
    return DEFAULT_MILESTONES;
  });

  const [configOpen, setConfigOpen] = useState(false);
  const [targetInterest, setTargetInterest] = useState(10000);
  const [whatIfDeposit, setWhatIfDeposit] = useState(config.monthlyDeposit);
  const [whatIfRate, setWhatIfRate] = useState(config.annualRate);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");
  const [newMilestoneAmount, setNewMilestoneAmount] = useState("");

  // ── Persist to localStorage ──
  useEffect(() => {
    localStorage.setItem("wealth-config", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem("wealth-milestones", JSON.stringify(milestones));
  }, [milestones]);

  // ── Helpers ──
  const updateConfig = useCallback((updates: Partial<WealthConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };

  // ── Computed data ──
  const projections = useMemo(
    () => generateProjections(config, 48),
    [config]
  );

  const enabledMilestones = useMemo(
    () => milestones.filter((m) => m.enabled),
    [milestones]
  );

  const milestoneEstimates = useMemo(() => {
    return enabledMilestones.map((m) => ({
      ...m,
      reachedMonth: findMilestoneMonth(projections, m.targetAmount),
      progress: Math.min(
        100,
        (config.startingBalance / m.targetAmount) * 100
      ),
    }));
  }, [enabledMilestones, projections, config.startingBalance]);

  const nextMilestone = useMemo(() => {
    return (
      milestoneEstimates.find(
        (m) => config.startingBalance < m.targetAmount
      ) || null
    );
  }, [milestoneEstimates, config.startingBalance]);

  const requiredBalance = useMemo(
    () => calcRequiredBalance(targetInterest, config.annualRate),
    [targetInterest, config.annualRate]
  );

  const monthsToRequired = useMemo(
    () => calcMonthsToTarget(config, requiredBalance),
    [config, requiredBalance]
  );

  const requiredDate = useMemo(
    () => addMonth(config.startMonth, monthsToRequired),
    [config.startMonth, monthsToRequired]
  );

  const whatIfProjections = useMemo(() => {
    const whatIfConfig = {
      ...config,
      monthlyDeposit: whatIfDeposit,
      annualRate: whatIfRate,
    };
    return generateProjections(whatIfConfig, 48);
  }, [config, whatIfDeposit, whatIfRate]);

  const latestProjection = projections[0];

  const cashFlow = useMemo(
    () => ({
      salary: config.netSalary,
      expenses: config.monthlyExpenses,
      investment: config.monthlyDeposit,
      interest: latestProjection?.interest || 0,
      float: latestProjection?.floatIncome || 0,
    }),
    [config, latestProjection]
  );

  // ── Milestone helpers for what-if comparison ──
  const milestoneDeltaData = useMemo(() => {
    return enabledMilestones.map((m) => {
      const baseMonth = findMilestoneMonth(projections, m.targetAmount);
      const whatIfMonth = findMilestoneMonth(
        whatIfProjections,
        m.targetAmount
      );

      let baseIndex: number | null = null;
      let whatIfIndex: number | null = null;

      if (baseMonth) {
        baseIndex = projections.findIndex((p) => p.month === baseMonth);
      }
      if (whatIfMonth) {
        whatIfIndex = whatIfProjections.findIndex(
          (p) => p.month === whatIfMonth
        );
      }

      let delta: number | null = null;
      if (baseIndex !== null && whatIfIndex !== null) {
        delta = baseIndex - whatIfIndex;
      }

      return {
        label: m.label,
        targetAmount: m.targetAmount,
        baseMonth,
        whatIfMonth,
        delta,
      };
    });
  }, [enabledMilestones, projections, whatIfProjections]);

  // ── Cash flow percentages ──
  const cashFlowTotal = cashFlow.salary;
  const expensesPct =
    cashFlowTotal > 0 ? (cashFlow.expenses / cashFlowTotal) * 100 : 0;
  const investmentPct =
    cashFlowTotal > 0 ? (cashFlow.investment / cashFlowTotal) * 100 : 0;
  const floatPct =
    cashFlowTotal > 0
      ? Math.max(0, 100 - expensesPct - investmentPct)
      : 0;

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
            <TrendingUp className="size-5 text-accent" />
            <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Wealth Builder
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
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* ── Section 1: Overview KPI Cards ── */}
          <SectionHeader title="Overview" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
              <Landmark className="size-4 text-accent" />
              <span className="text-lg font-bold text-foreground">
                {formatZAR(config.startingBalance)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Current Balance
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
              <PiggyBank className="size-4 text-accent" />
              <span className="text-lg font-bold text-foreground">
                {formatZAR(config.monthlyDeposit)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Monthly Deposit
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
              <TrendingUp className="size-4 text-accent" />
              <span className="text-lg font-bold text-foreground">
                {config.annualRate}% p.a.
              </span>
              <span className="text-[11px] text-muted-foreground">
                Interest Rate
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
              <Target className="size-4 text-accent" />
              <span className="text-lg font-bold text-foreground">
                {nextMilestone
                  ? formatZAR(nextMilestone.targetAmount)
                  : "All reached"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {nextMilestone ? nextMilestone.label : "Next Milestone"}
              </span>
            </div>
          </div>

          {/* Progress bar to next milestone */}
          {nextMilestone && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Progress to {nextMilestone.label}</span>
                <span className="tabular-nums">
                  {nextMilestone.progress.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${nextMilestone.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Section 2: Configuration Panel ── */}
          <SectionHeader title="Configuration" />
          <Card>
            <CardContent className="p-0">
              <button
                onClick={() => setConfigOpen(!configOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/5 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Settings className="size-4 text-muted-foreground" />
                  Adjust Assumptions
                </span>
                {configOpen ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>

              {configOpen && (
                <div className="border-t border-border px-4 py-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Starting Balance (R)
                      </label>
                      <Input
                        type="number"
                        value={config.startingBalance}
                        onChange={(e) =>
                          updateConfig({
                            startingBalance: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Monthly Deposit (R)
                      </label>
                      <Input
                        type="number"
                        value={config.monthlyDeposit}
                        onChange={(e) =>
                          updateConfig({
                            monthlyDeposit: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Annual Rate (%)
                      </label>
                      <Input
                        type="number"
                        step="0.25"
                        value={config.annualRate}
                        onChange={(e) =>
                          updateConfig({
                            annualRate: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Net Salary (R)
                      </label>
                      <Input
                        type="number"
                        value={config.netSalary}
                        onChange={(e) =>
                          updateConfig({
                            netSalary: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Monthly Expenses (R)
                      </label>
                      <Input
                        type="number"
                        value={config.monthlyExpenses}
                        onChange={(e) =>
                          updateConfig({
                            monthlyExpenses: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Start Month
                      </label>
                      <Input
                        type="month"
                        value={config.startMonth}
                        onChange={(e) =>
                          updateConfig({ startMonth: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  {/* Property toggle */}
                  <div className="mt-4 border-t border-border pt-4">
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.propertyEnabled}
                        onChange={(e) =>
                          updateConfig({
                            propertyEnabled: e.target.checked,
                          })
                        }
                        className="size-4 rounded border-border accent-accent"
                      />
                      <Home className="size-4 text-muted-foreground" />
                      Property Purchase
                    </label>
                    {config.propertyEnabled && (
                      <div className="mt-3 grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">
                            Property Amount (R)
                          </label>
                          <Input
                            type="number"
                            value={config.propertyAmount}
                            onChange={(e) =>
                              updateConfig({
                                propertyAmount: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">
                            Month Index (from start)
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={config.propertyMonth}
                              onChange={(e) =>
                                updateConfig({
                                  propertyMonth: Number(e.target.value),
                                })
                              }
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatMonthLabel(
                                addMonth(
                                  config.startMonth,
                                  config.propertyMonth
                                )
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reset button */}
                  <div className="mt-4 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setConfig(DEFAULT_CONFIG);
                        setMilestones(DEFAULT_MILESTONES);
                      }}
                    >
                      <RotateCcw className="size-3" />
                      Reset to Defaults
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 3: Investment Balance Growth ── */}
          <SectionHeader title="Investment Balance Growth" />
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={projections}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => formatZAR(value as number)}
                    contentStyle={tooltipStyle}
                  />
                  <Legend />
                  {enabledMilestones.map((m) => (
                    <ReferenceLine
                      key={m.id}
                      y={m.targetAmount}
                      stroke="var(--color-muted-foreground)"
                      strokeDasharray="4 4"
                      label={{
                        value: m.label,
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "var(--color-muted-foreground)",
                      }}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="closingBalance"
                    name="Balance"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Section 4: Monthly Interest Income ── */}
          <SectionHeader title="Monthly Interest Income" />
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projections}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => formatZAR(value as number)}
                    contentStyle={tooltipStyle}
                  />
                  <Bar
                    dataKey="interest"
                    name="Interest"
                    fill="var(--color-accent)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Section 5: Projections Table ── */}
          <SectionHeader title="Projections" />
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Month</th>
                      <th className="px-4 py-3 font-medium text-right">
                        Opening
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Deposit
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Interest
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Closing
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        Float
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...projections].reverse().map((row) => (
                      <tr
                        key={row.month}
                        className={`border-b border-border last:border-0 ${
                          row.milestoneReached ? "bg-accent/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium">
                          <span>{row.label}</span>
                          {row.milestoneReached && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                              {row.milestoneReached}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatZAR(row.openingBalance)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatZAR(row.deposit)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatZAR(Math.round(row.interest))}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {formatZAR(row.closingBalance)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatZAR(Math.round(row.floatIncome))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── Section 6: Milestone Tracker ── */}
          <SectionHeader title="Milestone Tracker" />
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                {milestones.map((m) => {
                  const estimate = milestoneEstimates.find(
                    (e) => e.id === m.id
                  );
                  const progress = Math.min(
                    100,
                    (config.startingBalance / m.targetAmount) * 100
                  );
                  const reached = config.startingBalance >= m.targetAmount;

                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg border border-border p-3 ${
                        !m.enabled ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setMilestones((prev) =>
                                prev.map((ms) =>
                                  ms.id === m.id
                                    ? { ...ms, enabled: !ms.enabled }
                                    : ms
                                )
                              );
                            }}
                            className={`flex size-5 items-center justify-center rounded border text-[10px] transition-colors ${
                              m.enabled
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-border bg-card text-muted-foreground"
                            }`}
                          >
                            {m.enabled ? "✓" : ""}
                          </button>
                          <span className="text-sm font-medium text-foreground">
                            {m.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {formatZAR(m.targetAmount)}
                          </span>
                          {!DEFAULT_MILESTONES.find(
                            (dm) => dm.id === m.id
                          ) && (
                            <button
                              onClick={() =>
                                setMilestones((prev) =>
                                  prev.filter((ms) => ms.id !== m.id)
                                )
                              }
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-border overflow-hidden mb-1">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            reached ? "bg-green-500" : "bg-accent"
                          }`}
                          style={{
                            width: `${Math.min(100, progress)}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="tabular-nums">
                          {progress.toFixed(1)}%
                        </span>
                        <span>
                          {reached
                            ? "Reached"
                            : estimate?.reachedMonth
                              ? `Est. ${formatMonthLabel(estimate.reachedMonth)}`
                              : "Beyond projection"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add custom milestone */}
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Add Custom Milestone
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Label"
                    value={newMilestoneLabel}
                    onChange={(e) => setNewMilestoneLabel(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={newMilestoneAmount}
                    onChange={(e) => setNewMilestoneAmount(e.target.value)}
                    className="w-32"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      !newMilestoneLabel || !newMilestoneAmount
                    }
                    onClick={() => {
                      const amount = Number(newMilestoneAmount);
                      if (!newMilestoneLabel || amount <= 0) return;
                      const id = `custom-${Date.now()}`;
                      setMilestones((prev) => [
                        ...prev,
                        {
                          id,
                          label: newMilestoneLabel,
                          targetAmount: amount,
                          enabled: true,
                        },
                      ]);
                      setNewMilestoneLabel("");
                      setNewMilestoneAmount("");
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Section 7: Live Off Interest Calculator ── */}
          <SectionHeader title="Live Off Interest Calculator" />
          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-foreground flex items-center gap-2">
                    <Calculator className="size-4 text-muted-foreground" />
                    Target Monthly Interest
                  </label>
                  <span className="text-sm font-semibold tabular-nums text-accent">
                    {formatZAR(targetInterest)}/month
                  </span>
                </div>
                <input
                  type="range"
                  min={5000}
                  max={30000}
                  step={1000}
                  value={targetInterest}
                  onChange={(e) =>
                    setTargetInterest(Number(e.target.value))
                  }
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-border accent-accent"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>R5,000</span>
                  <span>R30,000</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
                  <Banknote className="size-4 text-accent" />
                  <span className="text-lg font-bold text-foreground tabular-nums">
                    {formatZAR(Math.round(requiredBalance))}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Required Balance
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-4">
                  <Target className="size-4 text-accent" />
                  <span className="text-lg font-bold text-foreground">
                    {formatMonthLabel(requiredDate)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Estimated Date
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Section 8: What-If Calculator ── */}
          <SectionHeader title="What-If Calculator" />
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-foreground">
                      Monthly Deposit
                    </label>
                    <span className="text-sm font-semibold tabular-nums text-accent">
                      {formatZAR(whatIfDeposit)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={15000}
                    max={40000}
                    step={500}
                    value={whatIfDeposit}
                    onChange={(e) =>
                      setWhatIfDeposit(Number(e.target.value))
                    }
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-border accent-accent"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>R15,000</span>
                    <span>R40,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-foreground">
                      Interest Rate
                    </label>
                    <span className="text-sm font-semibold tabular-nums text-accent">
                      {whatIfRate}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={10}
                    step={0.25}
                    value={whatIfRate}
                    onChange={(e) =>
                      setWhatIfRate(Number(e.target.value))
                    }
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-border accent-accent"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>5%</span>
                    <span>10%</span>
                  </div>
                </div>
              </div>

              {/* Milestone comparison */}
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                  Milestone Comparison
                </p>
                <div className="space-y-2">
                  {milestoneDeltaData.map((m) => (
                    <div
                      key={m.label}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium text-foreground">
                          {m.label}
                        </span>
                        <div className="flex gap-3 text-[11px] text-muted-foreground">
                          <span>
                            Base:{" "}
                            {m.baseMonth
                              ? formatMonthLabel(m.baseMonth)
                              : "N/A"}
                          </span>
                          <span>
                            What-if:{" "}
                            {m.whatIfMonth
                              ? formatMonthLabel(m.whatIfMonth)
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                      {m.delta !== null && (
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            m.delta > 0
                              ? "text-green-600"
                              : m.delta < 0
                                ? "text-red-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          {m.delta > 0
                            ? `${m.delta}mo sooner`
                            : m.delta < 0
                              ? `${Math.abs(m.delta)}mo later`
                              : "Same"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Section 9: Cash Flow Breakdown ── */}
          <SectionHeader title="Cash Flow Breakdown" />
          <Card>
            <CardContent className="p-4">
              {/* Horizontal bar */}
              <div className="mb-4">
                <div className="flex h-6 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-red-400 transition-all duration-500"
                    style={{ width: `${expensesPct}%` }}
                    title={`Expenses: ${expensesPct.toFixed(1)}%`}
                  />
                  <div
                    className="bg-accent transition-all duration-500"
                    style={{ width: `${investmentPct}%` }}
                    title={`Investment: ${investmentPct.toFixed(1)}%`}
                  />
                  <div
                    className="bg-green-500 transition-all duration-500"
                    style={{ width: `${floatPct}%` }}
                    title={`Float: ${floatPct.toFixed(1)}%`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-full bg-red-400" />
                    Expenses
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-full bg-accent" />
                    Investment
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-full bg-green-500" />
                    Float
                  </span>
                </div>
              </div>

              {/* Stat items */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <div>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatZAR(cashFlow.salary)}
                  </span>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Wallet className="size-3" />
                    Net Salary
                  </p>
                </div>
                <div>
                  <span className="text-sm font-semibold tabular-nums text-red-500">
                    {formatZAR(cashFlow.expenses)}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Expenses
                  </p>
                </div>
                <div>
                  <span className="text-sm font-semibold tabular-nums text-accent">
                    {formatZAR(cashFlow.investment)}
                  </span>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <PiggyBank className="size-3" />
                    Investment
                  </p>
                </div>
                <div>
                  <span className="text-sm font-semibold tabular-nums text-green-600">
                    {formatZAR(Math.round(cashFlow.float))}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Float
                  </p>
                </div>
              </div>

              {/* Interest bonus line */}
              <div className="mt-3 rounded-xl border border-border bg-card/50 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Monthly interest of{" "}
                  <span className="font-semibold text-foreground">
                    {formatZAR(Math.round(cashFlow.interest))}
                  </span>{" "}
                  flows into your float income, boosting your available
                  spending money.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-10 border-t border-border pt-6 text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              All calculations are projections based on current inputs.
              Actual results may vary.
            </p>
            <p className="text-xs text-muted-foreground">
              Configuration saved locally in your browser.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
