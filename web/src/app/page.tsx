"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Shield } from "lucide-react";

export default function Home() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <main className="flex max-w-lg flex-col items-center text-center">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
          <Shield className="size-7 text-accent" />
        </div>

        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Payslip Vault
        </h1>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
          Secure, encrypted payslip storage with zero-knowledge browser
          decryption. Your password never leaves your device.
        </p>

        {isPending ? (
          <div className="mt-8 h-10 w-48 animate-pulse rounded-md bg-muted" />
        ) : session ? (
          <Button asChild size="lg" className="mt-8">
            <Link href="/history">View Payslip History</Link>
          </Button>
        ) : (
          <Button asChild size="lg" className="mt-8">
            <Link href="/login">Sign In</Link>
          </Button>
        )}

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
