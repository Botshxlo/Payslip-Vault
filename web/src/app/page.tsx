export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        background: "#fafafa",
      }}
    >
      <div style={{ maxWidth: 500, textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
          Payslip Vault
        </h1>
        <p style={{ color: "#666", fontSize: "1.1rem", lineHeight: 1.6 }}>
          Secure, encrypted payslip storage with zero-knowledge browser
          decryption. Your payslips are encrypted with AES-256-GCM and can only
          be viewed with your vault password.
        </p>
        <p
          style={{
            color: "#999",
            fontSize: "0.875rem",
            marginTop: "2rem",
          }}
        >
          This is a personal tool. Payslip links are delivered via Slack.
        </p>
      </div>
    </div>
  );
}
