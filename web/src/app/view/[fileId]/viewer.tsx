"use client";

import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { decryptBuffer } from "@/lib/decrypt";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type ViewerState =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "ready"; url: string; numPages: number }
  | { step: "error"; message: string };

export default function Viewer({ fileId }: { fileId: string }) {
  const [state, setState] = useState<ViewerState>({ step: "idle" });
  const [password, setPassword] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      setState({ step: "loading" });

      try {
        const res = await fetch(`/api/file/${fileId}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "File not found. It may have been deleted."
              : `Failed to fetch file (${res.status})`
          );
        }

        const encryptedData = await res.arrayBuffer();
        const pdfBytes = await decryptBuffer(encryptedData, password);

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
      }
    },
    [password, fileId]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: state.step === "ready" ? "flex-start" : "center",
        padding: "2rem",
        background: "#fafafa",
      }}
    >
      {state.step !== "ready" && (
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Payslip Vault
          </h1>
          <p
            style={{
              color: "#666",
              fontSize: "0.875rem",
              marginBottom: "2rem",
            }}
          >
            Enter your vault password to decrypt and view this payslip.
            <br />
            Your password never leaves your browser.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Vault password"
              required
              disabled={state.step === "loading"}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                fontSize: "1rem",
                border: "1px solid #ddd",
                borderRadius: 8,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="submit"
              disabled={state.step === "loading" || !password}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem",
                fontSize: "1rem",
                background: state.step === "loading" ? "#999" : "#111",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor:
                  state.step === "loading" ? "not-allowed" : "pointer",
              }}
            >
              {state.step === "loading" ? "Decrypting..." : "Decrypt & View"}
            </button>
          </form>

          {state.step === "error" && (
            <p
              style={{
                color: "#dc2626",
                marginTop: "1rem",
                fontSize: "0.875rem",
              }}
            >
              {state.message}
            </p>
          )}
        </div>
      )}

      {state.step === "ready" && (
        <div style={{ width: "100%", maxWidth: 800 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Your Payslip</h2>
            <a
              href={state.url}
              download="payslip.pdf"
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                background: "#111",
                color: "#fff",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              Download PDF
            </a>
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
              <div key={i} style={{ marginBottom: "1rem" }}>
                <Page
                  pageNumber={i + 1}
                  width={Math.min(800, window.innerWidth - 64)}
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
