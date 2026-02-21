import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var m=window.matchMedia('(prefers-color-scheme:dark)');if(m.matches)d.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${dmSans.variable} font-sans`}>
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
