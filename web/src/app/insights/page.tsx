"use client";

import dynamic from "next/dynamic";

const InsightsViewer = dynamic(() => import("./insights-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="size-6 animate-spin text-muted-foreground"
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
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  ),
});

export default function InsightsPage() {
  return <InsightsViewer />;
}
