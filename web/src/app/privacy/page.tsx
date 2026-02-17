export default function Privacy() {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "3rem 2rem",
        fontFamily: "system-ui, sans-serif",
        background: "#fafafa",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 600, lineHeight: 1.7 }}>
        <h1>Privacy Policy</h1>
        <p style={{ color: "#666" }}>Last updated: February 2026</p>

        <h2>Overview</h2>
        <p>
          Payslip Vault is a personal tool for securely storing and viewing
          encrypted payslips. It is not a public service and is intended for use
          by the account owner only.
        </p>

        <h2>Data Collection</h2>
        <p>
          This application does not collect, store, or share any personal data
          beyond what is necessary for its core function:
        </p>
        <ul>
          <li>
            <strong>Gmail access</strong> is used solely to detect incoming
            payslip emails and extract PDF attachments. Emails are marked as read
            after processing.
          </li>
          <li>
            <strong>Google Drive access</strong> is used to store encrypted
            payslip files and serve them to the web viewer.
          </li>
        </ul>

        <h2>Encryption &amp; Security</h2>
        <p>
          All payslips are encrypted with AES-256-GCM before being stored.
          Decryption happens entirely in the browser — your vault password is
          never transmitted to any server (zero-knowledge architecture).
        </p>

        <h2>Third Parties</h2>
        <p>
          No data is shared with third parties. The application uses Google APIs
          (Gmail, Drive) and Vercel for hosting. No analytics or tracking is
          used.
        </p>

        <h2>Contact</h2>
        <p>
          For questions about this policy, contact the application owner
          directly.
        </p>
      </div>
    </div>
  );
}
