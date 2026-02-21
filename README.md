# Payslip Vault

A zero-knowledge payslip management system that automates the retrieval, encryption, and analysis of salary payslips. Built for privacy-first personal finance tracking — your salary figures are encrypted at rest and only ever decrypted in your browser.

## Why I Built This

Every month, my employer (via SimplePay) emails me a password-protected PDF payslip. The process of downloading it, unlocking it, filing it somewhere safe, and comparing it to previous months was tedious and error-prone. I wanted to:

1. **Never lose a payslip again** — automated retrieval and storage in Google Drive
2. **Keep salary data private** — even if someone gains access to my Drive or database, they see only encrypted blobs
3. **Track salary trends over time** — see how my gross pay, deductions, and net pay evolve month to month without manually entering data into a spreadsheet
4. **Get notified of changes** — if my PAYE goes up 5% or a new deduction appears, I want to know immediately via Slack

The result is a fully automated pipeline: email arrives, PDF is processed, encrypted, stored, analyzed, and I get a Slack notification — all within minutes, without lifting a finger.

## Architecture

```
                                    Payslip Vault Architecture
                                    ========================

    +-----------+        +--------------------+        +----------------+
    |  SimplePay |------->|      Gmail         |        |   Google Drive  |
    |  (Employer)|  email |  (payslip inbox)   |        |  "Payslip Vault"|
    +-----------+        +--------+-----------+        +-------+--------+
                                  |                            ^
                                  | poll (cron)                | upload .enc
                                  v                            |
                    +-------------+----------------------------+--------+
                    |                Trigger.dev Worker                  |
                    |                                                    |
                    |  poll-gmail  -->  process-payslip  -->  notify     |
                    |                     |                              |
                    |              +------+------+                      |
                    |              |             |                      |
                    |         strip PDF    encrypt PDF                  |
                    |         password     (AES-256-GCM)               |
                    |              |             |                      |
                    |              v             v                      |
                    |         parse text   upload to Drive              |
                    |              |                                    |
                    |              v                                    |
                    |     encrypt JSON  -->  store in Turso             |
                    |              |                                    |
                    |              v                                    |
                    |     detect changes  -->  Slack alert (% only)    |
                    |                                                    |
                    |  sync-payslip-data (daily cron)                   |
                    |     Drive <--> Turso reconciliation               |
                    +--------------------+-----------------------------+
                                         |
                                         | encrypted rows
                                         v
                    +--------------------+-----------------------------+
                    |                  Turso (LibSQL)                   |
                    |                                                    |
                    |  payslip_data: encrypted JSON blobs (base64)      |
                    |  session/user: auth tables (better-auth)          |
                    +--------------------+-----------------------------+
                                         |
                                         | fetch encrypted rows
                                         v
                    +--------------------+-----------------------------+
                    |              Next.js Web App (Vercel)             |
                    |                                                    |
                    |  /history    — list payslips from Drive           |
                    |  /view/:id   — decrypt & render PDF in browser   |
                    |  /insights   — decrypt all, render salary charts |
                    |                                                    |
                    |  +--------------------------------------------+  |
                    |  |           Browser (client-side)             |  |
                    |  |                                            |  |
                    |  |  vault password --> scrypt key derivation  |  |
                    |  |  SubtleCrypto AES-256-GCM decrypt         |  |
                    |  |  password NEVER sent to server             |  |
                    |  |  auto-locks after 5 min inactivity        |  |
                    |  +--------------------------------------------+  |
                    +--------------------------------------------------+

                    +--------------------------------------------------+
                    |                    Slack                          |
                    |                                                    |
                    |  - New payslip notification with viewer link      |
                    |  - Month-over-month % changes (no amounts)       |
                    +--------------------------------------------------+
```

## How It Works

### Automated Pipeline

1. **SimplePay** sends a password-protected PDF payslip to Gmail
2. **Trigger.dev worker** polls Gmail on a schedule (every 10 min during payslip window)
3. PDF password is stripped using `qpdf` with the employee ID number
4. The unlocked PDF is **encrypted** with AES-256-GCM using the vault secret
5. Encrypted `.enc` file is uploaded to a **Google Drive** folder
6. Payslip text is extracted, parsed into structured data (gross, net, deductions, etc.)
7. Structured data is **encrypted as JSON** and stored in **Turso** (LibSQL)
8. Previous month's data is fetched and **compared** — percentage changes are sent to **Slack**
9. The original email is **trashed** (recoverable for 30 days)

### Zero-Knowledge Viewer

The web app never sees your salary figures in plaintext:

- The server returns encrypted blobs (`.enc` files or encrypted JSON)
- You enter your vault password **in the browser**
- Key derivation (scrypt) and decryption (AES-256-GCM) happen entirely **client-side** using the Web Crypto API
- The password is cleared from memory immediately after decryption starts
- The viewer auto-locks after 5 minutes of inactivity

### Salary Insights

The `/insights` dashboard decrypts all payslip data client-side and renders:

- **Net pay trend** — line chart showing take-home pay over time
- **Deduction breakdown** — stacked bar chart (PAYE, UIF, pension, medical aid, etc.)
- **Month-over-month changes** — bar chart showing percentage changes
- **Detailed table** — every month's figures with change indicators
- **Summary cards** — latest net pay, months tracked, average net pay

### Daily Sync

A daily cron job reconciles the Turso database with Google Drive:

- Files in Drive but not in Turso are ingested (downloaded, decrypted, parsed, re-encrypted, stored)
- Rows in Turso for files deleted from Drive are removed
- This ensures the insights dashboard always reflects what's actually in Drive

## Project Structure

```
payslip-vault/
├── src/
│   ├── trigger/                  # Trigger.dev scheduled tasks
│   │   ├── poll-gmail.ts         # Cron: poll Gmail for new payslips
│   │   ├── payslip.ts            # Process a single payslip end-to-end
│   │   └── sync-payslip-data.ts  # Cron: reconcile Turso <-> Drive
│   └── lib/                      # Shared libraries
│       ├── gmail.ts              # Gmail API (find, extract, mark, trash)
│       ├── storage.ts            # Google Drive API (upload, list, download)
│       ├── decrypt-pdf.ts        # Strip PDF password via qpdf
│       ├── encrypt.ts            # AES-256-GCM encrypt/decrypt
│       ├── parse-payslip.ts      # PDF text extraction & SimplePay parser
│       ├── payslip-store.ts      # Encrypted JSON storage in Turso
│       ├── detect-changes.ts     # Month-over-month change detection
│       ├── notify.ts             # Slack webhook notifications
│       └── turso.ts              # Turso/LibSQL client singleton
├── scripts/
│   ├── inspect-payslip.ts        # Debug: view raw PDF text & parsed data
│   ├── migrate.ts                # Create payslip_data table in Turso
│   ├── backfill.ts               # Backfill Turso from existing Drive files
│   ├── import.ts                 # Manual payslip import from local PDFs
│   └── decrypt.ts                # CLI decryption tool
├── web/                          # Next.js 15 app (Vercel)
│   └── src/
│       ├── app/
│       │   ├── page.tsx          # Landing page
│       │   ├── login/            # Google OAuth login
│       │   ├── history/          # Payslip list from Drive
│       │   ├── view/[fileId]/    # Single payslip PDF viewer
│       │   ├── insights/         # Salary trends dashboard
│       │   └── api/
│       │       ├── auth/         # better-auth endpoints
│       │       ├── files/        # List Drive files
│       │       ├── file/[id]/    # Download single .enc file
│       │       └── payslip-data/ # Encrypted JSON rows from Turso
│       └── lib/
│           ├── decrypt.ts        # Browser-side AES-256-GCM + scrypt
│           ├── auth.ts           # better-auth server config
│           └── auth-client.ts    # better-auth client
├── trigger.config.ts             # Trigger.dev build config
├── .dockerignore                 # Exclude web/ from worker builds
└── CLAUDE.md                     # AI development instructions
```

## Encryption Format

All encrypted data (both `.enc` files and JSON blobs) uses the same binary format:

```
[salt: 16 bytes] [iv: 12 bytes] [authTag: 16 bytes] [ciphertext: variable]
```

| Component | Details |
|-----------|---------|
| Algorithm | AES-256-GCM |
| Key derivation | scrypt (N=16384, r=8, p=1) |
| Salt | 16 random bytes per encryption |
| IV | 12 random bytes per encryption |
| Auth tag | 16 bytes (GCM integrity check) |

The server uses Node.js `crypto.scryptSync` + `createCipheriv`. The browser uses `scrypt-js` + `SubtleCrypto`. Parameters are identical on both sides — changing either breaks decryption silently at the GCM auth step.

## Slack Notifications

Slack alerts are privacy-conscious — they show **percentage changes only**, never absolute amounts:

```
Payslip 2025-10-31 — Changes Detected

  Net Pay         ↑ 4.7%
  PAYE            ↑ 3.2%
  Basic Salary    ↑ 6.0%
  Pension Fund    (new)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Worker runtime | [Trigger.dev](https://trigger.dev) v4 (Docker, cron schedules) |
| PDF processing | `qpdf` (password stripping), `pdf-parse` (text extraction) |
| Encryption | AES-256-GCM with scrypt key derivation |
| Email | Gmail API (OAuth2) |
| File storage | Google Drive API (OAuth2) |
| Database | [Turso](https://turso.tech) (LibSQL) — encrypted payslip JSON |
| Web framework | [Next.js](https://nextjs.org) 15 (App Router, React 19) |
| Authentication | [better-auth](https://better-auth.com) (Google OAuth) |
| Browser crypto | Web Crypto API (`SubtleCrypto`) + `scrypt-js` |
| Charts | [Recharts](https://recharts.org) |
| PDF rendering | `react-pdf` (pdfjs-dist) |
| UI | Tailwind CSS 4, shadcn/ui, Lucide icons |
| Hosting | [Vercel](https://vercel.com) (web), Trigger.dev Cloud (worker) |
| Notifications | Slack (incoming webhook) |

## Environment Variables

### Root `.env` (Trigger.dev worker)

| Variable | Purpose |
|----------|---------|
| `TRIGGER_SECRET_KEY` | Trigger.dev project auth |
| `ID_NUMBER` | Employee ID (PDF password) |
| `VAULT_SECRET` | AES-256-GCM encryption passphrase |
| `GMAIL_CLIENT_ID` | Gmail OAuth2 |
| `GMAIL_CLIENT_SECRET` | Gmail OAuth2 |
| `GMAIL_REDIRECT_URI` | Gmail OAuth2 |
| `GMAIL_REFRESH_TOKEN` | Gmail OAuth2 |
| `GOOGLE_CLIENT_ID` | Drive OAuth2 |
| `GOOGLE_CLIENT_SECRET` | Drive OAuth2 |
| `GOOGLE_REDIRECT_URI` | Drive OAuth2 |
| `GOOGLE_REFRESH_TOKEN` | Drive OAuth2 |
| `SLACK_WEBHOOK_URL` | Slack notifications |
| `VIEWER_BASE_URL` | Web app URL for payslip links |
| `TURSO_DATABASE_URL` | Turso database connection |
| `TURSO_AUTH_TOKEN` | Turso auth |

### Web `web/.env.local`

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Drive OAuth2 (same as root) |
| `GOOGLE_CLIENT_SECRET` | Drive OAuth2 |
| `GOOGLE_REDIRECT_URI` | Drive OAuth2 |
| `GOOGLE_REFRESH_TOKEN` | Drive OAuth2 |
| `TURSO_DATABASE_URL` | Turso database (shared with root) |
| `TURSO_AUTH_TOKEN` | Turso auth |
| `BETTER_AUTH_SECRET` | Session signing key |

## Scripts

```bash
# Root (Trigger.dev worker)
npm run dev              # Start local dev mode
npm run deploy           # Deploy to Trigger.dev cloud

# Utilities
npx tsx scripts/migrate.ts          # Create Turso table
npx tsx scripts/backfill.ts         # Backfill Turso from Drive
npx tsx scripts/import.ts           # Import local PDFs to Drive + Turso
npx tsx scripts/inspect-payslip.ts  # Debug: view parsed payslip data
npx tsx scripts/decrypt.ts <file>   # Decrypt a .enc file to PDF

# Web (from web/ directory)
npm run dev              # Next.js dev server
npm run build            # Production build
vercel --yes --prod      # Deploy to Vercel
```

## Payslip Parser

The parser handles SimplePay (South Africa) payslip PDFs with a section-based approach:

```
Income         [Current]  [YTD]     <- gross pay
  Basic Salary [Current]  [YTD]
Allowance      [Current]  [YTD]     <- optional section
  Travel       [Current]  [YTD]
Deduction      [Current]  [YTD]     <- total deductions
  UIF          [Current]  [YTD]
  Tax (PAYE)   [Current]  [YTD]
Employer Contribution ...
Benefit        ...
NETT PAY       R xx,xxx.xx
```

It also supports **merged PDFs** — if multiple payslips are combined into one file (e.g. a mid-month and end-of-month payslip), the parser splits on `NETT PAY` boundaries and sums the results.

## Security Model

| Threat | Mitigation |
|--------|-----------|
| Drive account compromised | Files are AES-256-GCM encrypted; attacker sees only `.enc` blobs |
| Database compromised | Turso stores encrypted JSON (base64); no plaintext salary data |
| Server compromised | Vault password never touches the server; decryption is browser-only |
| Slack message intercepted | Only percentage changes are shown, never absolute amounts |
| Session hijacked | Google OAuth via better-auth; protected API routes check session |
| Brute-force password | scrypt key derivation (N=16384) makes brute-force expensive |
| Unattended browser | Auto-lock after 5 minutes clears all decrypted data from memory |
| Stale password in DOM | Password is cleared from React state immediately on submit |

## License

Private project. Not open-sourced.
