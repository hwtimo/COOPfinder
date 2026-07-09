import type {
  MockAISuggestion,
  MockKeywordChecklistItem,
  MockMasterResume,
  MockResumeVersion,
  MockStudentProfile,
} from "./types";

export const mockStudentProfile: MockStudentProfile = {
  name: "Maya Chen",
  initials: "MC",
  email: "maya.chen@sfu.ca",
  phone: "604-555-0198",
  location: "Burnaby, BC",
  school: "SFU",
  program: "Engineering / Computing Science",
  year: "3rd year",
  term: "Fall 2026",
  workAuthorization: "International eligible",
  targetRoles: ["Software", "Embedded", "Data"],
};

export const currentUser = mockStudentProfile;

export const mockMasterResume: MockMasterResume = {
  id: "master-resume",
  title: "Master Resume",
  updatedAt: "2026-07-08",
  summary:
    "SFU Engineering and Computing Science student with software, embedded systems, and data analysis project experience.",
  education: [
    "Simon Fraser University - BEng / BSc, Engineering and Computing Science",
    "Relevant coursework: Data Structures, Software Engineering, Operating Systems, Database Systems",
    "Co-op eligible for Fall 2026 and Winter 2027 terms",
  ],
  bullets: [
    {
      id: "rb-1",
      section: "project",
      source: "Course planning web app",
      text: "Built a React and TypeScript course planning tool with reusable components and API-backed schedule search.",
      skills: ["React", "TypeScript", "REST APIs", "Component design"],
      impact: "Reduced manual schedule comparison during team testing.",
    },
    {
      id: "rb-2",
      section: "project",
      source: "Campus events API",
      text: "Implemented REST endpoints in Node.js for event filtering, validation, and user-facing status messages.",
      skills: ["Node.js", "REST APIs", "Validation", "Git"],
    },
    {
      id: "rb-3",
      section: "project",
      source: "Transit analytics dashboard",
      text: "Cleaned CSV transit data with Python and SQL, then built dashboard views for route delay patterns.",
      skills: ["Python", "SQL", "Data cleaning", "Dashboards"],
      impact: "Identified peak-hour delay trends across three sample routes.",
    },
    {
      id: "rb-4",
      section: "project",
      source: "Robotics club firmware utility",
      text: "Wrote C++ utilities for sensor calibration and logged test results during robotics club integration sessions.",
      skills: ["C++", "Embedded systems", "Debugging", "Testing"],
    },
    {
      id: "rb-5",
      section: "experience",
      source: "Peer tutoring",
      text: "Tutored first-year programming students on debugging, Git workflows, and breaking assignments into smaller tasks.",
      skills: ["Communication", "Git", "Debugging", "Mentorship"],
    },
    {
      id: "rb-6",
      section: "skills",
      source: "Technical skills",
      text: "Languages: TypeScript, JavaScript, Python, SQL, C++, Java. Tools: Git, Linux, Figma, Excel.",
      skills: ["TypeScript", "Python", "SQL", "C++", "Git", "Linux", "Excel"],
    },
  ],
  skills: {
    languages: ["TypeScript", "JavaScript", "Python", "SQL", "C++", "Java"],
    frameworks: ["React", "Next.js", "Node.js"],
    tools: ["Git", "Linux", "Figma", "Excel", "Postman"],
    other: ["Debugging", "Data cleaning", "Technical writing", "Testing"],
  },
};

export const mockResumeBullets = mockMasterResume.bullets;

export const mockResumeVersions: MockResumeVersion[] = [
  {
    id: "rv-1",
    name: "Software Co-op v3",
    focus: "Software",
    updatedAt: "2026-07-08",
    usedFor: ["TELUS", "Hootsuite", "Shopify", "Clio"],
    callbackEstimate: "14%",
    notes: "Leads with React, TypeScript, APIs, and testing evidence.",
  },
  {
    id: "rv-2",
    name: "Embedded v1",
    focus: "Embedded",
    updatedAt: "2026-07-07",
    usedFor: ["D-Wave", "BlackBerry QNX", "Nokia"],
    callbackEstimate: "9%",
    notes: "Moves C++, debugging, Linux, and robotics work above web projects.",
  },
  {
    id: "rv-3",
    name: "Data Analyst v2",
    focus: "Data",
    updatedAt: "2026-07-07",
    usedFor: ["RBC", "BC Hydro"],
    callbackEstimate: "11%",
    notes: "Highlights SQL, dashboards, Excel, data cleaning, and reporting.",
  },
  {
    id: "rv-4",
    name: "Cloud Platform v1",
    focus: "Cloud",
    updatedAt: "2026-07-03",
    usedFor: ["SAP"],
    callbackEstimate: "8%",
    notes: "Emphasizes APIs, monitoring language, and developer tooling.",
  },
];

export const mockResumePerformance = {
  versions: 6,
  estimatedCallbackRate: "14%",
  mostUsedVersion: "Software Co-op v3",
  helper: "Based on applications sent this term",
  nextAction: "Compare resume versions",
  href: "/resumes",
};

export const mockAISuggestions: MockAISuggestion[] = [
  {
    id: "sug-1",
    jobId: "j1",
    resumeBulletId: "rb-1",
    label: "Make TypeScript and API work easier to scan",
    before:
      "Built a React and TypeScript course planning tool with reusable components and API-backed schedule search.",
    after:
      "Built a React and TypeScript course planning tool with reusable UI components and REST API-backed schedule search for student workflows.",
    rationale:
      "TELUS calls out TypeScript, APIs, and customer-facing tools. This keeps the claim grounded in the existing project.",
    trustLabel: "Based on your existing resume",
    status: "pending",
    keywords: ["TypeScript", "React", "REST APIs"],
  },
  {
    id: "sug-2",
    jobId: "j2",
    resumeBulletId: "rb-4",
    label: "Bring embedded validation forward",
    before:
      "Wrote C++ utilities for sensor calibration and logged test results during robotics club integration sessions.",
    after:
      "Wrote C++ sensor calibration utilities and documented integration test results during robotics club debugging sessions.",
    rationale:
      "D-Wave emphasizes embedded software, debugging, and test automation. This suggestion does not invent firmware ownership.",
    trustLabel: "Needs confirmation",
    status: "pending",
    keywords: ["C++", "Debugging", "Testing"],
  },
  {
    id: "sug-3",
    jobId: "j3",
    resumeBulletId: "rb-3",
    label: "Align data project with analyst role language",
    before:
      "Cleaned CSV transit data with Python and SQL, then built dashboard views for route delay patterns.",
    after:
      "Cleaned transit datasets with Python and SQL, then built dashboard views to summarize route delay trends for non-technical readers.",
    rationale:
      "RBC values SQL, dashboards, reporting, and communication. The edit keeps the original data project intact.",
    trustLabel: "Suggested by AI",
    status: "pending",
    keywords: ["SQL", "Dashboards", "Reporting"],
  },
];

export const mockKeywordChecklist: MockKeywordChecklistItem[] = [
  {
    id: "kw-1",
    jobId: "j1",
    keyword: "TypeScript",
    status: "covered",
    source: "Course planning web app",
  },
  {
    id: "kw-2",
    jobId: "j1",
    keyword: "Cloud services",
    status: "missing",
    source: "No supported resume source yet",
  },
  {
    id: "kw-3",
    jobId: "j2",
    keyword: "Firmware",
    status: "review",
    source: "Robotics club firmware utility",
  },
  {
    id: "kw-4",
    jobId: "j2",
    keyword: "Hardware-in-the-loop",
    status: "missing",
    source: "No supported resume source yet",
  },
  {
    id: "kw-5",
    jobId: "j3",
    keyword: "SQL",
    status: "covered",
    source: "Transit analytics dashboard",
  },
  {
    id: "kw-6",
    jobId: "j3",
    keyword: "Power BI",
    status: "missing",
    source: "No supported resume source yet",
  },
];
