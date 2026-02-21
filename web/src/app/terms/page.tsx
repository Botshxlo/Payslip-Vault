import Link from "next/link";

export default function Terms() {
  return (
    <div className="flex min-h-svh flex-col items-center px-6 py-12">
      <article className="w-full max-w-xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back
        </Link>

        <h1 className="mt-6 font-heading text-2xl font-bold tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last updated: February 2026
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Acceptance
            </h2>
            <p>
              By using Payslip Vault, you agree to these terms. This is a
              personal application and is not intended for public use.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Use of Service
            </h2>
            <p>
              Payslip Vault is provided as-is for the sole purpose of securely
              storing and viewing encrypted payslip documents. The application is
              intended for personal use by the account owner only.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Security
            </h2>
            <p>
              You are responsible for keeping your vault password secure. The
              application cannot recover your password or decrypt files without
              it. Lost passwords cannot be reset.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Limitation of Liability
            </h2>
            <p>
              This application is provided without warranty of any kind. The
              developer is not liable for any loss of data or inability to access
              stored payslips.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Changes
            </h2>
            <p>These terms may be updated at any time without notice.</p>
          </section>
        </div>
      </article>
    </div>
  );
}
