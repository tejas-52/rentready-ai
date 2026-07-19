import { DOC_SLOTS } from "@/lib/document-registry";
import type { AppState, DocumentUI } from "@/lib/app-queries";

// Realistic demo persona for judges/first-time viewers.
const NAME = "John Carter";
const NOW = Date.now();
const day = (n: number) => new Date(NOW - n * 86400_000).toISOString();

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

type SlotDemo = {
  status: "verified" | "pending" | "issue" | "missing";
  confidence: number | null;
  issue?: string;
  extracted?: { label: string; value: string }[];
  daysAgo: number;
};

const slotData: Record<string, SlotDemo> = {
  passport: {
    status: "verified",
    confidence: 98,
    daysAgo: 6,
    extracted: [
      { label: "full name", value: NAME },
      { label: "date of birth", value: "12 Aug 1993" },
      { label: "nationality", value: "British" },
      { label: "passport number", value: "P58924102" },
      { label: "expiry", value: "04 Nov 2031" },
    ],
  },
  visa: {
    status: "verified",
    confidence: 96,
    daysAgo: 6,
    extracted: [
      { label: "visa type", value: "Skilled Worker" },
      { label: "status", value: "Valid" },
      { label: "expiry", value: "18 Mar 2027" },
      { label: "sponsor", value: "Northwind Labs" },
    ],
  },
  employment: {
    status: "verified",
    confidence: 94,
    daysAgo: 5,
    extracted: [
      { label: "employer", value: "Northwind Labs" },
      { label: "job title", value: "Senior Product Designer" },
      { label: "start date", value: "03 Feb 2022" },
      { label: "contract", value: "Permanent · Full-time" },
    ],
  },
  payslip: {
    status: "verified",
    confidence: 92,
    daysAgo: 4,
    extracted: [
      { label: "employer", value: "Northwind Labs" },
      { label: "gross monthly", value: "£6,850.00" },
      { label: "net monthly", value: "£4,920.00" },
      { label: "pay date", value: shortDate(day(9)) },
    ],
  },
  bank: {
    status: "verified",
    confidence: 90,
    daysAgo: 3,
    extracted: [
      { label: "account holder", value: NAME },
      { label: "bank", value: "Monzo" },
      { label: "average balance", value: "£8,240.00" },
      { label: "monthly income", value: "£4,920.00" },
    ],
  },
  tax: {
    status: "issue",
    confidence: 61,
    daysAgo: 2,
    issue: "Low contrast on last page — try re-scanning in daylight.",
    extracted: [
      { label: "tax year", value: "2024 / 2025" },
      { label: "utr", value: "10293-84029" },
    ],
  },
  utility: {
    status: "verified",
    confidence: 88,
    daysAgo: 2,
    extracted: [
      { label: "provider", value: "Octopus Energy" },
      { label: "address", value: "18 Redchurch St, London E2 7DP" },
      { label: "bill date", value: shortDate(day(11)) },
    ],
  },
  reference: {
    status: "missing",
    confidence: null,
    daysAgo: 0,
  },
};

const demoDocuments: DocumentUI[] = DOC_SLOTS.map((slot) => {
  const d = slotData[slot.id];
  return {
    ...slot,
    status: d.status,
    confidence: d.confidence,
    issue: d.issue,
    extracted: d.extracted,
    document:
      d.status === "missing"
        ? undefined
        : ({
            id: `demo-${slot.id}`,
            application_id: "demo-app",
            storage_path: `demo/${slot.id}.pdf`,
            file_name: `${slot.fallbackName}.pdf`,
            mime_type: "application/pdf",
            doc_type: slot.dbType,
            status: d.status === "verified" ? "verified" : d.status === "issue" ? "verified" : "pending",
            confidence: d.confidence,
            error: null,
            created_at: day(d.daysAgo),
          } as any),
  };
});

const verifiedCount = demoDocuments.filter((d) => d.status === "verified").length;
const CONFIDENCE = 87;

export const DEMO_APP_STATE: AppState = {
  application: {
    id: "demo-app",
    user_id: "demo-user",
    status: "in_progress",
    confidence_score: CONFIDENCE,
    summary: null,
    created_at: day(7),
    updated_at: day(1),
  } as any,
  documents: demoDocuments,
  otherDocuments: [],
  extractionsByDoc: {},
  validation: {
    id: "demo-val",
    checks: [
      { name: "Identity match", passed: true, detail: "Passport & visa names align." },
      { name: "Income consistency", passed: true, detail: "Payslip matches bank deposits within 2%." },
      { name: "Address on utility", passed: true, detail: "Address appears on 2 documents." },
      { name: "Tax document clarity", passed: false, detail: "Last page is hard to read." },
    ],
    issues: [
      { severity: "medium", message: "Tax document last page is low contrast — re-scan recommended." },
      { severity: "low", message: "Add a rental reference letter to reach Excellent tier." },
    ],
    created_at: day(1),
  },
  recommendation: {
    id: "demo-reco",
    items: [
      {
        title: "Upload a rental reference letter",
        detail: "A landlord-signed reference from your previous tenancy.",
        impact: 6,
        eta_seconds: 45,
      },
      {
        title: "Re-scan tax document (last page)",
        detail: "Better lighting will bring confidence above 85%.",
        impact: 4,
        eta_seconds: 30,
      },
      {
        title: "Add a savings statement",
        detail: "Boosts financial confidence for higher-rent listings.",
        impact: 3,
        eta_seconds: 60,
      },
    ],
    created_at: day(1),
  },
  report: {
    id: "demo-report",
    content: {
      summary: `${NAME} — Senior Product Designer at Northwind Labs · £4,920/mo net · Skilled Worker visa valid through 2027.`,
    },
    created_at: day(1),
  },
  confidence: CONFIDENCE,
  verifiedCount,
  totalSlots: DOC_SLOTS.length,
  profileSummary: {
    fullName: NAME,
    occupation: "Senior Product Designer",
    employer: "Northwind Labs",
    monthlyIncome: "£4,920 / month",
    address: "18 Redchurch St, London E2 7DP",
    nationality: "British",
    visaStatus: "Skilled Worker · valid to Mar 2027",
    dob: "12 Aug 1993",
  },
  journey: [
    { id: "identity", name: "Identity", done: true },
    { id: "income", name: "Income", done: true },
    { id: "employment", name: "Employment", done: true },
    { id: "residence", name: "Residence", done: true },
    { id: "review", name: "Review", done: false, active: true },
  ],
  timeline: [
    { name: "Application Created", date: shortDate(day(7)), done: true, iconKey: "file" },
    { name: "Identity Verified", date: shortDate(day(6)), done: true, iconKey: "badge" },
    { name: "Employment Verified", date: shortDate(day(5)), done: true, iconKey: "briefcase" },
    { name: "Income Verified", date: shortDate(day(4)), done: true, iconKey: "banknote" },
    { name: "Residence Verified", date: shortDate(day(2)), done: true, iconKey: "home" },
    { name: "Application Ready", date: shortDate(day(1)), done: true, iconKey: "badge" },
  ],
  activityFeed: [
    { text: "Utility Bill verified", meta: "88%", tone: "success", iconKey: "check" },
    { text: "Bank Statement verified", meta: "90%", tone: "success", iconKey: "check" },
    { text: "Payslip verified", meta: "92%", tone: "success", iconKey: "check" },
    { text: "Tax document last page is low contrast — re-scan recommended.", tone: "warn", iconKey: "zap" },
  ],
  smartChecklist: [
    { name: "Upload rental reference letter", eta: "45 sec", impact: 6 },
    { name: "Re-scan tax document", eta: "30 sec", impact: 4 },
  ],
  improvements: [
    { title: "Upload rental reference letter", impact: 6 },
    { title: "Re-scan tax document (last page)", impact: 4 },
    { title: "Add a savings statement", impact: 3 },
  ],
  insight: {
    title: "You're 8% away from Excellent",
    body: "Adding a landlord reference letter will move your application into the highest tier.",
  },
  radarAxes: [
    { key: "identity", label: "Identity", value: 98 },
    { key: "income", label: "Income", value: 91 },
    { key: "employment", label: "Employment", value: 94 },
    { key: "residence", label: "Residence", value: 88 },
  ],
  recentUploads: demoDocuments
    .filter((d) => d.status === "verified")
    .slice(-3),
};

// ---------- Chat demo ----------

export type DemoMessage = { id: string; role: "user" | "assistant"; text: string };

export const DEMO_CHAT: DemoMessage[] = [
  {
    id: "demo-c1",
    role: "user",
    text: "Why is my rental confidence 87%?",
  },
  {
    id: "demo-c2",
    role: "assistant",
    text:
      "Your score is 87% because your identity, income, employment and residence are all verified — but two items are still holding you back: the last page of your tax document scanned at 61% confidence, and you haven't added a rental reference letter yet. Fixing those two would move you into the Excellent tier (95%+).",
  },
  {
    id: "demo-c3",
    role: "user",
    text: "How much do I earn according to my documents?",
  },
  {
    id: "demo-c4",
    role: "assistant",
    text:
      "Based on your payslip and Monzo statement, you earn £6,850 gross / £4,920 net per month at Northwind Labs. Your average balance over the last 3 months is £8,240 — a healthy signal for landlords looking at rent-to-income ratio.",
  },
  {
    id: "demo-c5",
    role: "user",
    text: "What should I fix next?",
  },
  {
    id: "demo-c6",
    role: "assistant",
    text:
      "Two quick wins: (1) re-scan the last page of your tax document in daylight — 30 seconds, +4% score. (2) Upload a rental reference letter from your previous landlord — 45 seconds, +6% score. Do both and you'll land at 97%.",
  },
];

// Canned responses used when a judge sends a message in demo mode.
const DEMO_REPLIES: { match: RegExp; text: string }[] = [
  {
    match: /score|confidence|rating/i,
    text:
      "Your rental confidence is 87% — Strong tier. Landlords typically approve applications above 80%, but adding a reference letter and re-scanning your tax document will push you to 97%.",
  },
  {
    match: /income|salary|earn|money/i,
    text:
      "Your payslip shows £6,850 gross / £4,920 net per month at Northwind Labs, and your bank statement confirms consistent deposits with an £8,240 average balance.",
  },
  {
    match: /missing|next|fix|improve|recommend/i,
    text:
      "You're missing a rental reference letter (+6%) and your tax document's last page scanned poorly (+4% if re-scanned). Fix both and you'll be at 97%.",
  },
  {
    match: /landlord|report|preview|share/i,
    text:
      "Your landlord report is ready. Open the Report tab and toggle 'Landlord Preview' to see exactly what a landlord will see — a one-page summary with verified identity, income, employment and residence.",
  },
  {
    match: /visa|passport|identity/i,
    text:
      "Your identity is fully verified: British passport (98% confidence) and a valid Skilled Worker visa through March 2027, both sponsored by Northwind Labs.",
  },
];

export function demoReplyFor(userText: string): string {
  const match = DEMO_REPLIES.find((r) => r.match.test(userText));
  return (
    match?.text ??
    "In demo mode I'm showing scripted answers for John Carter's sample application. Try asking about the score, income, what to fix next, or the landlord report."
  );
}
