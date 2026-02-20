import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <main className="flex max-w-lg flex-col items-center text-center">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
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
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">
          Payslip Vault
        </h1>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
          Secure, encrypted payslip storage with zero-knowledge browser
          decryption. Your password never leaves your device.
        </p>

        <Button asChild size="lg" className="mt-8">
          <Link href="/history">View Payslip History</Link>
        </Button>

        <p className="mt-6 text-sm text-muted-foreground/60">
          This is a personal tool. Payslip links are delivered via Slack.
        </p>
      </main>

      <footer className="mt-auto flex gap-4 pt-12 text-xs text-muted-foreground/50">
        <Link href="/privacy" className="transition-colors hover:text-muted-foreground">
          Privacy Policy
        </Link>
        <span>&middot;</span>
        <Link href="/terms" className="transition-colors hover:text-muted-foreground">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
