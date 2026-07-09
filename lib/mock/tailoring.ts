import type { MockTailoringSession } from "./types";

/**
 * Mock tailoring session for the Northstar Robotics job (j11).
 * Every suggestion cites a master-resume bullet id (or null when the
 * suggestion is NOT supported — that one must carry a warning).
 */
export const mockTailoringSessions: Record<string, MockTailoringSession> = {
  j11: {
    id: "ts-j11",
    jobId: "j11",
    versionName: "Northstar Software v1",
    baseVersionName: "Software Co-op v3",
    createdAt: "2026-07-08",
    sections: [
      {
        id: "sec-projects",
        heading: "Projects",
        entries: [
          {
            id: "en-planner",
            title: "Course planning web app",
            subtitle: "Personal project · React, TypeScript",
            bullets: [
              {
                id: "b-planner-1",
                text: "Built a React and TypeScript course planning tool with reusable components and API-backed schedule search.",
                suggestionId: "ts-sug-1",
              },
              {
                id: "b-planner-2",
                text: "Versioned features with Git branches and small pull requests during weekly iterations.",
              },
            ],
          },
          {
            id: "en-events-api",
            title: "Campus events API",
            subtitle: "Course project · Node.js, REST",
            bullets: [
              {
                id: "b-events-1",
                text: "Implemented REST endpoints in Node.js for event filtering, validation, and user-facing status messages.",
                suggestionId: "ts-sug-2",
              },
            ],
          },
          {
            id: "en-robotics",
            title: "Robotics club firmware utility",
            subtitle: "Student team · C++",
            bullets: [
              {
                id: "b-robotics-1",
                text: "Wrote C++ utilities for sensor calibration and logged test results during robotics club integration sessions.",
                suggestionId: "ts-sug-4",
              },
            ],
          },
        ],
      },
      {
        id: "sec-experience",
        heading: "Experience",
        entries: [
          {
            id: "en-tutoring",
            title: "Peer tutor, first-year programming",
            subtitle: "SFU · Part-time",
            bullets: [
              {
                id: "b-tutoring-1",
                text: "Tutored first-year programming students on debugging, Git workflows, and breaking assignments into smaller tasks.",
                suggestionId: "ts-sug-3",
              },
            ],
          },
          {
            id: "en-team",
            title: "Student engineering project team",
            subtitle: "SFU · Team member",
            bullets: [
              {
                id: "b-team-1",
                text: "Coordinated weekly integration sessions and shared short written status updates with a five-person student team.",
                suggestionId: "ts-sug-5",
              },
            ],
          },
        ],
      },
      {
        id: "sec-skills",
        heading: "Skills",
        entries: [
          {
            id: "en-skills",
            title: "Technical skills",
            bullets: [
              {
                id: "b-skills-1",
                text: "Languages: TypeScript, JavaScript, Python, SQL, C++, Java. Tools: Git, Linux, Figma, Excel.",
              },
            ],
          },
        ],
      },
    ],
    suggestions: [
      {
        id: "ts-sug-1",
        bulletId: "b-planner-1",
        sourceExperience: "Course planning web app (Project)",
        sourceBulletId: "rb-1",
        before:
          "Built a React and TypeScript course planning tool with reusable components and API-backed schedule search.",
        after:
          "Built a React and TypeScript course planning tool with reusable UI components and REST API-backed schedule search, debugging integration issues found in weekly testing.",
        rationale:
          "Northstar's top requirements are React, TypeScript, and REST APIs. Naming REST explicitly and surfacing the debugging you already did makes those matches scannable.",
        trustLabel: "Based on your existing resume",
        addedKeywords: ["REST APIs", "Debugging"],
      },
      {
        id: "ts-sug-2",
        bulletId: "b-events-1",
        sourceExperience: "Campus events API (Course project)",
        sourceBulletId: "rb-2",
        before:
          "Implemented REST endpoints in Node.js for event filtering, validation, and user-facing status messages.",
        after:
          "Implemented and documented REST endpoints in Node.js for event filtering and validation, reviewing teammates' pull requests in Git.",
        rationale:
          "The posting asks for everyday Git collaboration. Your master resume lists Git on this project; this phrasing shows how you used it.",
        trustLabel: "Suggested by AI",
        addedKeywords: ["Git", "Team collaboration"],
      },
      {
        id: "ts-sug-3",
        bulletId: "b-tutoring-1",
        sourceExperience: "Peer tutoring (Experience)",
        sourceBulletId: "rb-5",
        before:
          "Tutored first-year programming students on debugging, Git workflows, and breaking assignments into smaller tasks.",
        after:
          "Coached first-year students through debugging sessions and Git workflows, explaining fixes in plain language they could re-apply on their own.",
        rationale:
          "Northstar repeatedly mentions clear communication in a small team. This keeps the same tutoring facts but shows the communication skill directly.",
        trustLabel: "Based on your existing resume",
        addedKeywords: ["Clear communication", "Debugging"],
      },
      {
        id: "ts-sug-4",
        bulletId: "b-robotics-1",
        sourceExperience: "Robotics club firmware utility (Student team)",
        sourceBulletId: "rb-4",
        before:
          "Wrote C++ utilities for sensor calibration and logged test results during robotics club integration sessions.",
        after:
          "Wrote C++ sensor calibration utilities for a student robotics team and debugged integration issues with teammates during weekly build sessions.",
        rationale:
          "Robotics context is a plus for Northstar. \"Debugged with teammates\" is implied by your integration-session bullet but not stated — confirm it matches what you actually did.",
        trustLabel: "Needs confirmation",
        warning:
          "Confirm you debugged with teammates during those sessions before accepting. If you only logged results, keep the original wording.",
        addedKeywords: ["Debugging", "Team collaboration"],
      },
      {
        id: "ts-sug-5",
        bulletId: "b-team-1",
        sourceExperience: "No supported source found",
        sourceBulletId: null,
        before:
          "Coordinated weekly integration sessions and shared short written status updates with a five-person student team.",
        after:
          "Led Agile sprint ceremonies with product managers, coordinating a five-person team through two-week delivery cycles.",
        rationale:
          "The posting mentions team collaboration, but this rewrite introduces Agile ceremonies and product managers that do not appear anywhere in your master resume.",
        trustLabel: "Potential unsupported claim",
        warning:
          "Your master resume has no record of Agile ceremonies or working with product managers. Accepting this could overstate your experience — rejecting is recommended.",
        addedKeywords: ["Team collaboration"],
      },
    ],
    keywords: [
      {
        id: "kw-ns-1",
        keyword: "React",
        baseStatus: "covered",
        source: "Course planning web app",
      },
      {
        id: "kw-ns-2",
        keyword: "TypeScript",
        baseStatus: "covered",
        source: "Course planning web app",
      },
      {
        id: "kw-ns-3",
        keyword: "REST APIs",
        baseStatus: "review",
        source: "Campus events API",
        coveredBySuggestionIds: ["ts-sug-1", "ts-sug-2"],
      },
      {
        id: "kw-ns-4",
        keyword: "Git",
        baseStatus: "review",
        source: "Skills line only — not shown in a bullet yet",
        coveredBySuggestionIds: ["ts-sug-2"],
      },
      {
        id: "kw-ns-5",
        keyword: "Team collaboration",
        baseStatus: "review",
        source: "Student engineering project team",
        coveredBySuggestionIds: ["ts-sug-2", "ts-sug-4"],
      },
      {
        id: "kw-ns-6",
        keyword: "Debugging",
        baseStatus: "review",
        source: "Peer tutoring",
        coveredBySuggestionIds: ["ts-sug-1", "ts-sug-3", "ts-sug-4"],
      },
      {
        id: "kw-ns-7",
        keyword: "Clear communication",
        baseStatus: "review",
        source: "Peer tutoring",
        coveredBySuggestionIds: ["ts-sug-3"],
      },
      {
        id: "kw-ns-8",
        keyword: "CI/CD",
        baseStatus: "missing",
        source: "No supported source yet",
      },
      {
        id: "kw-ns-9",
        keyword: "Robot Operating System (ROS)",
        baseStatus: "missing",
        source: "No supported source yet",
      },
    ],
  },
};
