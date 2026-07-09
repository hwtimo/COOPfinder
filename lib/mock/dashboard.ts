import type { MockMetric, MockNextAction, MockPipelineStage } from "./types";

export const mockMetrics: MockMetric[] = [
  {
    label: "Saved jobs",
    value: 18,
    helper: "6 added this week",
    actionLabel: "Review saved jobs",
    href: "/jobs",
  },
  {
    label: "Ready to apply",
    value: 5,
    helper: "Tailored and reviewed",
    actionLabel: "Finish applications",
    href: "/applications",
  },
  {
    label: "Applications sent",
    value: 42,
    helper: "12 this term",
    actionLabel: "Log application",
    href: "/applications",
  },
  {
    label: "Interviews",
    value: 3,
    helper: "1 scheduled this week",
    actionLabel: "Prepare notes",
    href: "/calendar",
  },
  {
    label: "Overdue follow-ups",
    value: 1,
    helper: "Hootsuite · 2 days",
    tone: "warning",
    actionLabel: "Follow up today",
    href: "/applications",
  },
];

export const mockPipelineStages: MockPipelineStage[] = [
  {
    id: "saved",
    label: "Saved",
    count: 8,
    helper: "Need JD review",
    action: "Choose next job",
    href: "/jobs",
  },
  {
    id: "tailoring",
    label: "Tailoring",
    count: 3,
    helper: "Drafts in progress",
    action: "Review edits",
    href: "/resumes",
  },
  {
    id: "ready",
    label: "Ready",
    count: 5,
    helper: "Resume checked",
    action: "Send applications",
    href: "/applications",
  },
  {
    id: "applied",
    label: "Applied",
    count: 42,
    helper: "This search cycle",
    action: "Track replies",
    href: "/applications",
  },
  {
    id: "interview",
    label: "Interview",
    count: 3,
    helper: "Prep required",
    action: "Open calendar",
    href: "/calendar",
  },
  {
    id: "offer",
    label: "Offer",
    count: 1,
    helper: "Decision notes due",
    action: "Review offer",
    href: "/applications",
  },
  {
    id: "rejected",
    label: "Rejected",
    count: 6,
    helper: "Keep notes for learning",
    action: "Review patterns",
    href: "/insights",
  },
];

export const mockNextActions: MockNextAction[] = [
  {
    id: "a1",
    title: "Jobs ready for resume tailoring",
    detail: "RBC, BlackBerry QNX, and D-Wave need role-specific resume review.",
    action: "Tailor resumes",
    href: "/resumes",
  },
  {
    id: "a2",
    title: "Deadlines within 48 hours",
    detail: "TELUS closes tomorrow. D-Wave and RBC close in 2 days.",
    action: "See deadlines",
    href: "/jobs",
  },
  {
    id: "a3",
    title: "Follow-ups due today",
    detail: "Hootsuite interview follow-up is overdue by 2 days.",
    action: "Write follow-up",
    href: "/applications",
  },
];
