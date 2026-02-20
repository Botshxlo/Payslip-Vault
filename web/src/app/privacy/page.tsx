import Link from "next/link";

export default function Privacy() {
  return (
    <div className="flex min-h-svh flex-col items-center px-6 py-12">
      <article className="w-full max-w-xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last updated: February 2026
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Overview
            </h2>
            <p>
              Payslip Vault is a personal tool for securely storing and viewing
              encrypted payslips. It is not a public service and is intended for
              use by the account owner only.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Data Collection
            </h2>
            <p>
              This application does not collect, store, or share any personal
              data beyond what is necessary for its core function:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Gmail access</strong> is
                used solely to detect incoming payslip emails and extract PDF
                attachments. Emails are marked as read after processing.
              </li>
              <li>
                <strong className="text-foreground">Google Drive access</strong>{" "}
                is used to store encrypted payslip files and serve them to the
                web viewer.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Encryption &amp; Security
            </h2>
            <p>
              All payslips are encrypted with AES-256-GCM before being stored.
              Decryption happens entirely in the browser — your vault password is
              never transmitted to any server (zero-knowledge architecture).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Third Parties
            </h2>
            <p>
              No data is shared with third parties. The application uses Google
              APIs (Gmail, Drive) and Vercel for hosting. No analytics or
              tracking is used.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium text-foreground">
              Contact
            </h2>
            <p>
              For questions about this policy, contact the application owner
              directly.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
