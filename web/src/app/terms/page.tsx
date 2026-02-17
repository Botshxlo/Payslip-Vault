export default function Terms() {
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
        <h1>Terms of Service</h1>
        <p style={{ color: "#666" }}>Last updated: February 2026</p>

        <h2>Acceptance</h2>
        <p>
          By using Payslip Vault, you agree to these terms. This is a personal
          application and is not intended for public use.
        </p>

        <h2>Use of Service</h2>
        <p>
          Payslip Vault is provided as-is for the sole purpose of securely
          storing and viewing encrypted payslip documents. The application is
          intended for personal use by the account owner only.
        </p>

        <h2>Security</h2>
        <p>
          You are responsible for keeping your vault password secure. The
          application cannot recover your password or decrypt files without it.
          Lost passwords cannot be reset.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          This application is provided without warranty of any kind. The
          developer is not liable for any loss of data or inability to access
          stored payslips.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated at any time without notice.
        </p>
      </div>
    </div>
  );
}
