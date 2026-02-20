import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Payslip Vault",
  description:
    "Secure, encrypted payslip storage with zero-knowledge browser decryption.",
  openGraph: {
    title: "Payslip Vault",
    description:
      "Secure, encrypted payslip storage with zero-knowledge browser decryption.",
    siteName: "Payslip Vault",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
