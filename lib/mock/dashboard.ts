import type { MockMetric, MockNextAction, MockPipelineStage } from "./types";

export const mockMetrics: MockMetric[] = [
  {
    label: "Saved jobs",
    value: 11,
    helper: "3 added this week",
    actionLabel: "Review saved jobs",
    href: "/jobs",
  },
  {
    label: "Ready to apply",
    value: 2,
    helper: "Tailored and reviewed",
    actionLabel: "Finish applications",
    href: "/applications",
  },
  {
    label: "Applications sent",
    value: 5,
    helper: "Submitted this search",
    actionLabel: "Log application",
    href: "/applications",
  },
  {
    label: "Interviews",
    value: 1,
    helper: "Follow-up due",
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
    count: 2,
    helper: "Need JD review",
    action: "Choose next job",
    href: "/jobs",
  },
  {
    id: "tailoring",
    label: "Tailoring",
    count: 2,
    helper: "Drafts in progress",
    action: "Review edits",
    href: "/resumes",
  },
  {
    id: "ready",
    label: "Ready",
    count: 2,
    helper: "Resume checked",
    action: "Send applications",
    href: "/applications",
  },
  {
    id: "applied",
    label: "Applied",
    count: 2,
    helper: "Waiting on replies",
    action: "Track replies",
    href: "/applications",
  },
  {
    id: "interview",
    label: "Interview",
    count: 1,
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
    count: 1,
    helper: "Keep notes for learning",
    action: "Review patterns",
    href: "/insights",
  },
];

export const mockNextActions: MockNextAction[] = [
  {
    id: "a1",
    title: "Jobs ready for resume tailoring",
    detail: "Northstar and D-Wave have open tailoring drafts to review.",
    action: "Review tailoring",
    href: "/resumes/tailor/j11",
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
    action: "Open follow-up",
    href: "/applications/app-8",
  },
];
