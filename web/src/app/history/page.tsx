"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  ArrowLeft,
  LogOut,
  Shield,
  Search,
  X,
  FileText,
  Calendar,
  Clock,
  ChevronRight,
} from "lucide-react";

interface PayslipFile {
  id: string;
  name: string;
  createdTime: string;
}

type PageState =
  | { step: "loading" }
  | { step: "error"; message: string }
  | { step: "ready"; files: PayslipFile[] };

function cleanFilename(name: string): string {
  return name.replace(/_\d+\.enc$/, "");
}

function extractPayslipMonth(name: string): string | null {
  const cleaned = cleanFilename(name);
  const match = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
    return date.toLocaleDateString("en-ZA", {
      month: "long",
      year: "numeric",
    });
  }
  return null;
}

function extractPayslipDateParts(name: string) {
  const cleaned = cleanFilename(name);
  const match = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
    return {
      formatted: date.toLocaleDateString("en-ZA", { dateStyle: "long" }),
      shortMonth: date.toLocaleDateString("en-ZA", { month: "short" }),
      day: date.getDate(),
      iso: `${match[1]}-${match[2]}-${match[3]}`,
    };
  }
  return {
    formatted: cleaned,
    shortMonth: "—",
    day: 0,
    iso: "",
  };
}

function extractIsoDate(name: string): string {
  const match = cleanFilename(name).match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function sortByPayslipDate(files: PayslipFile[]): PayslipFile[] {
  return [...files].sort((a, b) => {
    const dateA = extractIsoDate(a.name);
    const dateB = extractIsoDate(b.name);
    // Descending — newest first; fall back to createdTime
    if (dateA && dateB) return dateB.localeCompare(dateA);
    if (dateA) return -1;
    if (dateB) return 1;
    return b.createdTime.localeCompare(a.createdTime);
  });
}

function groupByMonth(files: PayslipFile[]): Map<string, PayslipFile[]> {
  const groups = new Map<string, PayslipFile[]>();
  for (const file of files) {
    const key =
      extractPayslipMonth(file.name) ??
      new Date(file.createdTime).toLocaleDateString("en-ZA", {
        month: "long",
        year: "numeric",
      });
    const group = groups.get(key);
    if (group) {
      group.push(file);
    } else {
      groups.set(key, [file]);
    }
  }
  return groups;
}

export default function HistoryPage() {
  const [state, setState] = useState<PageState>({ step: "loading" });
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const loadFiles = () => {
    setState({ step: "loading" });
    fetch("/api/files")
      .then(async (res) => {
        if (res.status === 401) {
          toast.error("Session expired. Please sign in again.");
          window.location.href = "/login?redirect=/history";
          return;
        }
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const files: PayslipFile[] = await res.json();
        setState({ step: "ready", files: sortByPayslipDate(files) });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load";
        setState({ step: "error", message });
        toast.error(message);
      });
  };

  useEffect(loadFiles, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && search) {
        setSearch("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [search]);

  const filtered = useMemo(() => {
    if (state.step !== "ready") return [];
    if (!search.trim()) return state.files;
    const q = search.toLowerCase();
    return state.files.filter((f) => {
      const name = cleanFilename(f.name).toLowerCase();
      const month = (extractPayslipMonth(f.name) ?? "").toLowerCase();
      const dateParts = extractPayslipDateParts(f.name);
      return (
        name.includes(q) ||
        month.includes(q) ||
        dateParts.formatted.toLowerCase().includes(q)
      );
    });
  }, [state, search]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };

  const totalCount = state.step === "ready" ? state.files.length : 0;

  // Compute stats
  const stats = useMemo(() => {
    if (state.step !== "ready" || state.files.length === 0)
      return { total: 0, latest: "", months: 0 };
    const latestFile = state.files[0];
    const latestParts = extractPayslipDateParts(latestFile.name);
    const latestFormatted = latestParts.iso
      ? new Date(latestParts.iso).toLocaleDateString("en-ZA", {
          month: "short",
          year: "numeric",
        })
      : "—";
    const uniqueMonths = new Set(
      state.files.map((f) => extractPayslipMonth(f.name) ?? "unknown")
    );
    return {
      total: state.files.length,
      latest: latestFormatted,
      months: uniqueMonths.size,
    };
  }, [state]);

  // Determine if a file is the latest (first file overall)
  const latestFileId =
    state.step === "ready" && state.files.length > 0
      ? state.files[0].id
      : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <Shield className="size-5 text-accent" />
            <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Payslip Vault
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

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Title section */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl text-balance">
            Payslip History
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your complete payslip archive, securely stored.
          </p>
        </div>

        {/* Loading state */}
        {state.step === "loading" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="mt-3 h-11 w-full rounded-xl" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Error state */}
        {state.step === "error" && (
          <div className="mt-6 text-center">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={loadFiles}
            >
              Retry
            </Button>
          </div>
        )}

        {state.step === "ready" && (
          <>
            {/* Stats */}
            {totalCount > 0 && (
              <div className="mb-6 grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3">
                  <FileText className="size-4 text-accent" />
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {stats.total}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Total
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3">
                  <Calendar className="size-4 text-accent" />
                  <span className="text-lg font-bold text-foreground">
                    {stats.latest}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Latest
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3">
                  <Clock className="size-4 text-accent" />
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {stats.months}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Months
                  </span>
                </div>
              </div>
            )}

            {/* Search */}
            {totalCount > 0 && (
              <div className="relative mb-6">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search payslips..."
                  className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-20 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
                  aria-label="Search payslips"
                />
                {search ? (
                  <button
                    onClick={() => {
                      setSearch("");
                      searchRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Kbd>Esc</Kbd>
                  </div>
                )}
              </div>
            )}

            {/* Search results info */}
            {search && (
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "result" : "results"} for{" "}
                  <span className="font-medium text-foreground">
                    &ldquo;{search}&rdquo;
                  </span>
                </span>
              </div>
            )}

            {/* Empty state */}
            {totalCount === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="rounded-xl bg-secondary p-4">
                  <FileText className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    No payslips yet
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Payslips will appear here once they&apos;re processed from
                    your email.
                  </p>
                </div>
              </div>
            )}

            {/* No search results */}
            {totalCount > 0 && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="rounded-xl bg-secondary p-4">
                  <FileText className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    No payslips found
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting your search terms.
                  </p>
                </div>
              </div>
            )}

            {/* Payslip list grouped by month */}
            {filtered.length > 0 && (
              <div className="flex flex-col gap-6">
                {Array.from(grouped.entries()).map(
                  ([month, files], groupIndex) => (
                    <section key={month} aria-label={`Payslips for ${month}`}>
                      <div className="mb-2 flex items-center gap-3 px-1">
                        <h2 className="font-heading text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          {month}
                        </h2>
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {files.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {files.map((file) => {
                          const parts = extractPayslipDateParts(file.name);
                          const isLatest = file.id === latestFileId;
                          return (
                            <Link key={file.id} href={`/view/${file.id}`}>
                              <button
                                className="group relative flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-accent/40 hover:shadow-md hover:shadow-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.995]"
                                aria-label={`View payslip for ${parts.formatted}`}
                              >
                                {/* Date icon block */}
                                <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-foreground">
                                  <span className="text-[10px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">
                                    {parts.shortMonth}
                                  </span>
                                  <span className="text-lg font-bold leading-tight">
                                    {parts.day || "—"}
                                  </span>
                                </div>

                                {/* Content */}
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-foreground">
                                      {parts.formatted}
                                    </span>
                                    {isLatest && (
                                      <Badge className="bg-accent text-accent-foreground text-[10px] px-1.5 py-0 font-medium">
                                        Latest
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <FileText className="size-3" />
                                    <span>{cleanFilename(file.name)}</span>
                                  </div>
                                </div>

                                {/* Arrow */}
                                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                              </button>
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  )
                )}
              </div>
            )}

            {/* Footer */}
            {totalCount > 0 && (
              <div className="mt-10 border-t border-border pt-6 text-center">
                <p className="text-xs text-muted-foreground">
                  All documents are encrypted and securely stored.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
