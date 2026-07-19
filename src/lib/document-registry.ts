import {
  BadgeCheck,
  BookUser,
  Briefcase,
  FileText,
  Landmark,
  Plane,
  Receipt,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

export type DocStatus = "verified" | "pending" | "issue" | "missing";

export interface DocSlot {
  id: string;
  /** doc_type value as classified by the AI pipeline */
  dbType: string;
  /** i18n key under `documents.names.*` */
  nameKey: string;
  fallbackName: string;
  icon: ComponentType<any>;
}

/** Canonical 8 slots the UI renders on the Documents / Dashboard grid. */
export const DOC_SLOTS: DocSlot[] = [
  { id: "passport",   dbType: "passport",          nameKey: "documents.names.passport",   fallbackName: "Passport",           icon: Plane },
  { id: "visa",       dbType: "visa",              nameKey: "documents.names.visa",       fallbackName: "Visa",               icon: BadgeCheck },
  { id: "employment", dbType: "employment_letter", nameKey: "documents.names.employment", fallbackName: "Employment Letter",  icon: Briefcase },
  { id: "payslip",    dbType: "payslip",           nameKey: "documents.names.payslip",    fallbackName: "Payslip",            icon: Receipt },
  { id: "bank",       dbType: "bank_statement",    nameKey: "documents.names.bank",       fallbackName: "Bank Statement",     icon: Landmark },
  { id: "tax",        dbType: "tax",               nameKey: "documents.names.tax",        fallbackName: "Tax Documents",      icon: FileText },
  { id: "utility",    dbType: "utility_bill",      nameKey: "documents.names.utility",    fallbackName: "Utility Bill",       icon: Zap },
  { id: "reference",  dbType: "reference_letter",  nameKey: "documents.names.reference",  fallbackName: "Rental Reference",   icon: BookUser },
];

export function iconForDocType(dbType: string | null | undefined): ComponentType<any> {
  return DOC_SLOTS.find((s) => s.dbType === dbType)?.icon ?? FileText;
}
