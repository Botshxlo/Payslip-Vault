export interface PayslipData {
  grossPay: number;
  netPay: number;
  basicSalary: number;
  paye: number;
  uif: number;
  pension: number;
  medicalAid: number;
  otherDeductions: { name: string; amount: number }[];
  totalDeductions: number;
  allowances: { name: string; amount: number }[];
  benefits: { name: string; amount: number }[];
  bonus?: number;
  overtime?: number;
}

export interface PayslipParser {
  name: string;
  detect(text: string): boolean;
  parse(text: string): PayslipData;
}
