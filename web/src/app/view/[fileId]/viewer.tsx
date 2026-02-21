"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { decryptBuffer } from "@/lib/decrypt";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type ViewerState =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "ready"; url: string; numPages: number }
  | { step: "error"; message: string };

function usePageWidth() {
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 768
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Max 768px content width, minus horizontal padding (24px each side)
  return Math.min(768, width - 48);
}

const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes

export default function Viewer({ fileId }: { fileId: string }) {
  const [state, setState] = useState<ViewerState>({ step: "idle" });
  const [password, setPassword] = useState("");
  const pageWidth = usePageWidth();
  const lockTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Auto-lock: revoke blob URL and reset to idle after inactivity
  const resetLockTimer = useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      setState((s) => {
        if (s.step === "ready") {
          URL.revokeObjectURL(s.url);
          toast.info("Payslip locked due to inactivity.");
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

      setState({ step: "loading" });

      try {
        const res = await fetch(`/api/file/${fileId}`);
        if (res.status === 401) {
          toast.error("Session expired. Please sign in again.");
          window.location.href = `/login?redirect=/view/${fileId}`;
          return;
        }
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "File not found. It may have been deleted."
              : `Failed to fetch file (${res.status})`
          );
        }

        const encryptedData = await res.arrayBuffer();
        const pdfBytes = await decryptBuffer(encryptedData, pw);

        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);

        setState({ step: "ready", url, numPages: 0 });
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
    [password, fileId]
  );

  return (
    <div className="flex min-h-svh flex-col items-center px-6 py-8">
      {state.step !== "ready" && (
        <div className="flex flex-1 flex-col items-center justify-center w-full max-w-sm">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">
            Decrypt Payslip
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Enter your vault password to decrypt and view this payslip.
            <br />
            Your password never leaves your browser.
          </p>

          <Card className="mt-6 w-full">
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
                    <>
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
                      Decrypting...
                    </>
                  ) : (
                    "Decrypt & View"
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

          <Link
            href="/history"
            className="mt-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; Back to history
          </Link>
        </div>
      )}

      {state.step === "ready" && (
        <div className="w-full max-w-3xl">
          <div className="mb-4">
            <Link
              href="/history"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              &larr; Back to history
            </Link>
          </div>
          <Document
            file={state.url}
            onLoadSuccess={({ numPages }) =>
              setState((s) =>
                s.step === "ready" ? { ...s, numPages } : s
              )
            }
            onLoadError={(err) =>
              setState({
                step: "error",
                message: `PDF load failed: ${err.message}`,
              })
            }
          >
            {Array.from({ length: state.numPages }, (_, i) => (
              <div key={i} className="mb-4 overflow-hidden rounded-lg border border-border">
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderAnnotationLayer
                  renderTextLayer
                />
              </div>
            ))}
          </Document>
        </div>
      )}
    </div>
  );
}
