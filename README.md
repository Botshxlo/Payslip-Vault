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
                    |  cpi_data: SA CPI index values (FRED)             |
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

- **All-time totals** — cumulative gross, net, deductions, and tax with filterable date ranges
- **Inflation-adjusted pay** — real net pay trend line using SA CPI data (FRED)
- **Net pay trend** — line chart showing nominal and real take-home pay over time
- **Deduction breakdown** — stacked bar chart (PAYE, UIF, pension, medical aid, etc.)
- **Month-over-month changes** — bar chart showing percentage changes
- **Detailed table** — every month's figures with change indicators
- **Proof of income** — generate a PDF summary for selected months

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
| Inflation data | [FRED API](https://fred.stlouisfed.org) (SA CPI series ZAFCPIALLMINMEI) |
| UI | Tailwind CSS 4, shadcn/ui, Lucide icons |
| Hosting | [Vercel](https://vercel.com) (web), Trigger.dev Cloud (worker) |
| Notifications | Slack (incoming webhook) |

See [CLAUDE.md](CLAUDE.md) for development setup, commands, and environment variables.

## License

Private project. Not open-sourced.
