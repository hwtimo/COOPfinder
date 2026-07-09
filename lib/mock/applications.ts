import type {
  MockApplication,
  MockApplicationColumn,
  MockApplicationTimelineItem,
} from "./types";

export const applicationColumns: MockApplicationColumn[] = [
  {
    id: "saved",
    label: "Saved",
    helper: "Needs review",
  },
  {
    id: "tailoring",
    label: "Tailoring",
    helper: "Resume edits",
  },
  {
    id: "ready",
    label: "Ready",
    helper: "Can apply",
  },
  {
    id: "applied",
    label: "Applied",
    helper: "Waiting",
  },
  {
    id: "interview",
    label: "Interview",
    helper: "Prep and follow-up",
  },
  {
    id: "offer",
    label: "Offer",
    helper: "Decision notes",
  },
  {
    id: "rejected",
    label: "Rejected",
    helper: "Archive learnings",
  },
];

export const mockApplications: MockApplication[] = [
  {
    id: "app-1",
    jobId: "j3",
    status: "saved",
    lastAction: "Saved from RBC careers after CMPT lab",
    nextAction: "Tailor data resume",
  },
  {
    id: "app-2",
    jobId: "j4",
    status: "saved",
    lastAction: "Added QNX posting from Waterloo search",
    nextAction: "Confirm relocation fit",
  },
  {
    id: "app-3",
    jobId: "j2",
    status: "tailoring",
    lastAction: "Embedded resume draft started",
    nextAction: "Review C++ and test automation bullets",
  },
  {
    id: "app-11",
    jobId: "j11",
    status: "tailoring",
    lastAction: "AI suggestions generated for Northstar draft",
    nextAction: "Review tailoring suggestions",
  },
  {
    id: "app-4",
    jobId: "j1",
    status: "ready",
    lastAction: "Software resume reviewed for TELUS",
    nextAction: "Submit application",
  },
  {
    id: "app-5",
    jobId: "j5",
    status: "ready",
    lastAction: "SQL project bullets tightened",
    nextAction: "Finish application form",
  },
  {
    id: "app-6",
    jobId: "j7",
    status: "applied",
    lastAction: "Applied through Shopify portal",
    nextAction: "Track confirmation email",
    followUpDue: "2026-07-15",
  },
  {
    id: "app-7",
    jobId: "j8",
    status: "applied",
    lastAction: "Application confirmation received",
    nextAction: "Follow up next week",
    followUpDue: "2026-07-16",
  },
  {
    id: "app-8",
    jobId: "j6",
    status: "interview",
    lastAction: "Interview completed on July 2",
    nextAction: "Send follow-up today",
    followUpDue: "2026-07-06",
  },
  {
    id: "app-9",
    jobId: "j9",
    status: "offer",
    lastAction: "Offer email received from recruiter",
    nextAction: "Compare offer notes",
  },
  {
    id: "app-10",
    jobId: "j10",
    status: "rejected",
    lastAction: "Rejection received on July 2",
    nextAction: "Archive lessons for network roles",
  },
];

export const mockApplicationTimeline: MockApplicationTimelineItem[] = [
  {
    id: "tl-1",
    applicationId: "app-4",
    label: "Job saved",
    detail: "TELUS posting saved from careers page.",
    date: "2026-07-07",
  },
  {
    id: "tl-2",
    applicationId: "app-4",
    label: "Resume tailored",
    detail: "Software Co-op v3 reviewed for TypeScript and API keywords.",
    date: "2026-07-08",
  },
  {
    id: "tl-3",
    applicationId: "app-8",
    label: "Interview completed",
    detail: "Hootsuite interview completed with product engineering team.",
    date: "2026-07-02",
  },
  {
    id: "tl-4",
    applicationId: "app-8",
    label: "Follow-up due",
    detail: "Send concise thank-you note and ask about next steps.",
    date: "2026-07-06",
  },
  {
    id: "tl-5",
    applicationId: "app-9",
    label: "Offer received",
    detail: "Clio offer email received; compare pay, term, and team fit.",
    date: "2026-07-05",
  },
];
