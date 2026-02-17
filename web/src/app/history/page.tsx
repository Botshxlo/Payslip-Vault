"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
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
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        background: "#fafafa",
      }}
    >
      <div style={{ maxWidth: 600, width: "100%" }}>
        <Link
          href="/"
          style={{
            color: "#666",
            fontSize: "0.875rem",
            textDecoration: "none",
          }}
        >
          &larr; Back
        </Link>
        <h1 style={{ fontSize: "1.5rem", marginTop: "0.5rem" }}>
          Payslip History
        </h1>

        {state.step === "loading" && (
          <p style={{ color: "#666" }}>Loading payslips...</p>
        )}

        {state.step === "error" && (
          <p style={{ color: "#dc2626" }}>{state.message}</p>
        )}

        {state.step === "ready" && state.files.length === 0 && (
          <p style={{ color: "#666" }}>No payslips yet.</p>
        )}

        {state.step === "ready" && state.files.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {state.files.map((file) => (
              <Link
                key={file.id}
                href={`/view/${file.id}`}
                style={{
                  display: "block",
                  padding: "1rem",
                  background: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ fontWeight: 500 }}>{formatDate(file.createdTime)}</div>
                <div style={{ color: "#666", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                  {cleanFilename(file.name)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
