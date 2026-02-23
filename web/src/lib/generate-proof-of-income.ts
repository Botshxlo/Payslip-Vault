import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface PayslipData {
  grossPay: number;
  netPay: number;
  totalDeductions: number;
}

interface DecryptedRow {
  payslipDate: string;
  data: PayslipData;
}

function formatZAR(amount: number): string {
  return amount.toLocaleString("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMonthLong(dateStr: string): string {
  const [year, month] = dateStr.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

export function generateProofOfIncome(rows: DecryptedRow[]): void {
  if (rows.length === 0) return;

  const sorted = [...rows].sort((a, b) =>
    a.payslipDate.localeCompare(b.payslipDate)
  );

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Proof of Income", pageWidth / 2, 25, { align: "center" });

  // Date range
  const firstMonth = formatMonthLong(sorted[0].payslipDate);
  const lastMonth = formatMonthLong(sorted[sorted.length - 1].payslipDate);
  const dateRange =
    sorted.length === 1 ? firstMonth : `${firstMonth} — ${lastMonth}`;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(dateRange, pageWidth / 2, 33, { align: "center" });

  // Generated date
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-ZA")}`,
    pageWidth / 2,
    40,
    { align: "center" }
  );
  doc.setTextColor(0);

  // Table data
  const tableBody = sorted.map((r) => [
    formatMonthLong(r.payslipDate),
    formatZAR(r.data.grossPay),
    formatZAR(r.data.totalDeductions),
    formatZAR(r.data.netPay),
  ]);

  const totalGross = sorted.reduce((s, r) => s + r.data.grossPay, 0);
  const totalDeductions = sorted.reduce(
    (s, r) => s + r.data.totalDeductions,
    0
  );
  const totalNet = sorted.reduce((s, r) => s + r.data.netPay, 0);

  const avgGross = totalGross / sorted.length;
  const avgDeductions = totalDeductions / sorted.length;
  const avgNet = totalNet / sorted.length;

  autoTable(doc, {
    startY: 48,
    head: [["Month", "Gross Pay", "Deductions", "Net Pay"]],
    body: tableBody,
    foot: [
      [
        "Total",
        formatZAR(totalGross),
        formatZAR(totalDeductions),
        formatZAR(totalNet),
      ],
      [
        "Average",
        formatZAR(avgGross),
        formatZAR(avgDeductions),
        formatZAR(avgNet),
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [41, 41, 41],
      textColor: 255,
      fontStyle: "bold",
      halign: "right",
    },
    footStyles: {
      fillColor: [245, 245, 245],
      textColor: 40,
      fontStyle: "bold",
      halign: "right",
    },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
  });

  // Disclaimer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 180;
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    "This document is auto-generated from encrypted payslip data and is not an official employer statement.",
    pageWidth / 2,
    finalY + 16,
    { align: "center", maxWidth: pageWidth - 40 }
  );

  // Download
  const today = new Date().toISOString().split("T")[0];
  doc.save(`proof-of-income-${today}.pdf`);
}
