import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import type { Metadata } from "next";
import WealthViewer from "./wealth-viewer";

export const metadata: Metadata = {
  title: "Wealth Builder — Payslip Vault",
  description: "Wealth projection and tracking dashboard",
};

export default async function WealthPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/wealth");
  return <WealthViewer />;
}
