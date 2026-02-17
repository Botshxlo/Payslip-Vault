# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Payslip Vault automates secure retrieval, encryption, and storage of PDF payslips. Two independent projects:

- **Root** — Trigger.dev worker that polls Gmail, strips PDF passwords, encrypts with AES-256-GCM, uploads to Google Drive, and notifies via Slack.
- **`web/`** — Next.js 15 app on Vercel serving a zero-knowledge browser-based payslip viewer (password never leaves the browser).

## Data Flow

```
Gmail (SimplePay) → Trigger.dev poll (hourly) → extract PDF → qpdf strip password
→ AES-256-GCM encrypt → Drive upload → Slack notification with viewer link
→ User clicks link → web app fetches .enc → browser decrypts → react-pdf renders
```

## Commands

### Root (Trigger.dev worker)
```bash
npm run dev          # Start Trigger.dev local dev mode
npm run deploy       # Deploy tasks to Trigger.dev cloud
npm run decrypt      # CLI: tsx scripts/decrypt.ts <file.enc> [output.pdf]
```

### Web (Next.js app, run from `web/`)
```bash
npm run dev          # Next.js dev server
npm run build        # Production build
vercel --yes --prod  # Deploy to Vercel from web/ directory
```

No test suite or linter is configured.

## Architecture

### Module Systems (do not mix)
- **Root**: ESM (`"type": "module"`, `moduleResolution: NodeNext`). All relative imports **must** use `.js` extension.
- **Web**: Next.js bundler (`moduleResolution: bundler`). Uses `@/*` path alias for `src/`. No `.js` extension needed.

These are separate npm projects with independent `node_modules`. They share no workspace tooling.

### Encryption Format
Binary layout of `.enc` files — must stay in sync between `src/lib/encrypt.ts` and `web/src/lib/decrypt.ts`:
```
[salt: 16 bytes] [iv: 12 bytes] [authTag: 16 bytes] [ciphertext: variable]
```
- Server: Node `scryptSync(password, salt, 32)` + `createCipheriv("aes-256-gcm")`
- Browser: `scrypt-js(password, salt, 16384, 8, 1, 32)` + `SubtleCrypto.decrypt("AES-GCM")`
- SubtleCrypto expects `[ciphertext || authTag]`, so the browser code rearranges bytes before decrypting.
- scrypt params (N=16384, r=8, p=1) match Node defaults — changing either side breaks decryption silently at GCM auth.

### Web Viewer Patterns
- `view/[fileId]/page.tsx` uses React 19 `use()` to unwrap async params, loads `viewer.tsx` via `next/dynamic` with `{ ssr: false }` (pdfjs-dist requires browser APIs).
- Viewer state is a discriminated union: `idle → loading → ready | error`.
- Wrong password detection: catch `DOMException` with `name === "OperationError"`.
- pdfjs worker loaded from `pdfjs-dist/build/pdf.worker.min.mjs` via `import.meta.url`.

### External Dependencies
- **qpdf** CLI must be available on the Trigger.dev worker runtime.
- Gmail filter is hardcoded: `from:noreply-ss@simplepay.cloud subject:payslip has:attachment is:unread`.
- Drive folder auto-creates as `"Payslip Vault"` if missing.
- Slack timestamps use `en-ZA` locale, `Africa/Johannesburg` timezone.

## Environment Variables

### Root `.env`
`TRIGGER_SECRET_KEY`, `ID_NUMBER` (PDF password), `VAULT_SECRET` (encryption passphrase), `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`, `GMAIL_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`, `SLACK_WEBHOOK_URL`, `VIEWER_BASE_URL`

### Web `web/.env.local`
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN` (same Drive credentials as root; no Gmail creds needed)

## Deployment
- **Worker**: Trigger.dev cloud (`npm run deploy`), project `proj_nyvrmpbepxfkjcuzmirx`
- **Web**: Vercel at `https://payslip-vault.vercel.app`, deployed from `web/` directory
