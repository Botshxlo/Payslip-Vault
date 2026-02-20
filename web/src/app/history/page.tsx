"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

function cleanFilename(name: string): string {
  return name.replace(/_\d+\.enc$/, "");
}

export default function HistoryPage() {
  const [state, setState] = useState<PageState>({ step: "loading" });

  const loadFiles = () => {
    setState({ step: "loading" });
    fetch("/api/files")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const files: PayslipFile[] = await res.json();
        setState({ step: "ready", files });
      })
      .catch((err) => {
        setState({
          step: "error",
          message: err instanceof Error ? err.message : "Failed to load",
        });
      });
  };

  useEffect(loadFiles, []);

  return (
    <div className="flex min-h-svh flex-col items-center px-6 py-8">
      <div className="w-full max-w-xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          Payslip History
        </h1>

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

        {state.step === "ready" && state.files.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            No payslips yet.
          </p>
        )}

        {state.step === "ready" && state.files.length > 0 && (
          <div className="mt-6 flex flex-col gap-3">
            {state.files.map((file) => (
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
        )}
      </div>
    </div>
  );
}
