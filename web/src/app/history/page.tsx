"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

interface PayslipFile {
  id: string;
  name: string;
  createdTime: string;
}

type PageState =
  | { step: "loading" }
  | { step: "error"; message: string }
  | { step: "ready"; files: PayslipFile[] };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { dateStyle: "long" });
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function cleanFilename(name: string): string {
  return name.replace(/_\d+\.enc$/, "");
}

function groupByMonth(files: PayslipFile[]): Map<string, PayslipFile[]> {
  const groups = new Map<string, PayslipFile[]>();
  for (const file of files) {
    const key = formatMonthYear(file.createdTime);
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
        setState({ step: "ready", files });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load";
        setState({ step: "error", message });
        toast.error(message);
      });
  };

  useEffect(loadFiles, []);

  // Escape key clears search
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
    return state.files.filter(
      (f) =>
        formatDate(f.createdTime).toLowerCase().includes(q) ||
        cleanFilename(f.name).toLowerCase().includes(q)
    );
  }, [state, search]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/";
  };

  const totalCount = state.step === "ready" ? state.files.length : 0;

  return (
    <div className="flex min-h-svh flex-col items-center px-6 py-8">
      <div className="w-full max-w-xl">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href="/"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              &larr; Back
            </Link>
            <div className="mt-3 flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight">
                Payslip History
              </h1>
              {totalCount > 0 && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {totalCount}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        {state.step === "loading" && (
          <div className="mt-6 flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        )}

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
            {state.files.length > 0 && (
              <Input
                ref={searchRef}
                placeholder="Search payslips... (Esc to clear)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-6"
              />
            )}

            {state.files.length === 0 && (
              <div className="mt-12 flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  </svg>
                </div>
                <p className="mt-4 text-sm font-medium">No payslips yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Payslips will appear here once they&apos;re processed from
                  your email.
                </p>
              </div>
            )}

            {state.files.length > 0 && filtered.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                No payslips matching &ldquo;{search}&rdquo;
              </p>
            )}

            {filtered.length > 0 && (
              <div className="mt-4 space-y-6">
                {Array.from(grouped.entries()).map(([month, files]) => (
                  <div key={month}>
                    <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {month}
                    </h2>
                    <div className="flex flex-col gap-3">
                      {files.map((file) => (
                        <Link key={file.id} href={`/view/${file.id}`}>
                          <Card className="cursor-pointer px-5 py-4 transition-colors hover:bg-accent">
                            <div className="font-medium">
                              {formatDate(file.createdTime)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {cleanFilename(file.name)}
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
