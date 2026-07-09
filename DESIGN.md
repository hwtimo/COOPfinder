# DESIGN.md — Canadian Co-op Application Manager

## 1. Product Identity

### Product
A productivity-first web app for Canadian university students managing co-op, internship, and new-grad applications.

Users can:
- Save job postings
- Analyze job descriptions with AI
- Tailor resumes to specific roles
- Track application status
- Manage deadlines, interviews, and follow-ups

### Design Direction
The UI should feel like:

> Asana dashboard + Linear clarity + Notion structure + Grammarly AI assistance

This is **not** a flashy AI SaaS landing page.  
This is a daily workflow tool for students applying to many jobs.

### Target Feeling
- Organized
- Calm
- Fast
- Trustworthy
- Professional but not corporate-heavy
- Student-friendly
- Dense enough for power users
- Simple enough for first-time users

---

## 2. Visual Reference

The main visual reference is Asana-style dashboard UI:

- Dark left sidebar
- White main canvas
- Top navigation bar
- Rounded white cards
- Thin borders
- Light gray page background
- Clear metrics
- Simple charts
- Lots of whitespace
- Minimal color accents
- Dashboard-first layout

Avoid:
- Heavy gradients
- Generic purple AI SaaS look
- Overly playful illustrations
- Neon colors
- Dense enterprise CRM feeling
- Too much animation

---

## 3. Core UX Principles

### 3.1 Always Show the Next Action
Every page should make it clear what the user should do next.

Examples:
- “Tailor resume”
- “Finish application”
- “Add deadline”
- “Prepare for interview”
- “Follow up today”

### 3.2 AI Must Be Reviewable
AI should never silently change or submit anything.

Use labels:
- “Suggested by AI”
- “Based on your existing resume”
- “Needs your confirmation”
- “Review before exporting”

### 3.3 No Fake Confidence
Do not present AI match scores as absolute truth.

Use:
- “Estimated match”
- “Likely missing keywords”
- “Potential improvement”

Avoid:
- “Guaranteed interview”
- “Perfect match”
- “You will get hired”

### 3.4 Workflow Over Search
This product is not mainly a job board.  
It is an application command center.

The main UX should focus on:
- What jobs the user saved
- What applications need action
- What resume versions exist
- What deadlines are coming
- What follow-ups are due

### 3.5 Canadian Co-op Specificity
Support Canadian student workflows:

- 4-month co-op
- 8-month co-op
- Summer internship
- Fall/Winter/Spring terms
- Domestic/international status
- Work authorization
- School co-op approval
- Location filters by province/city
- Hybrid/remote/on-site
- Program/year context

---

## 4. Layout System

### 4.1 App Shell

Use a persistent app shell:

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: Page title, search, quick add, account              │
├───────────────┬─────────────────────────────────────────────┤
│ Dark Sidebar  │ Main Content                                │
│ Navigation    │ Cards / tables / workspace                  │
│               │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

### 4.2 Sidebar

Dark sidebar inspired by Asana.

Width:
- Desktop: 240px
- Collapsed: 72px

Background:
- Near black / charcoal

Sections:
- Home
- Jobs
- Applications
- Resumes
- Calendar
- Insights
- Documents
- Settings

Secondary section:
- Saved views
- Current term
- Favorite companies
- Resume versions

Sidebar style:
- Small icons
- 14px labels
- Muted inactive items
- Clear active background
- Rounded active state
- Subtle dividers

### 4.3 Top Bar

Height:
- 56px to 64px

Elements:
- Page breadcrumb
- Page title
- Status pill when relevant
- Global search
- “Add job” button
- Notifications
- User avatar

Top bar should feel light and functional.

### 4.4 Main Canvas

Background:
- Very light gray

Content max width:
- Dashboard: full width
- Editor workspace: full width
- Form pages: 960px max

Card spacing:
- 16px gap desktop
- 12px gap smaller screens

---

## 5. Color System

Use a restrained palette.

### 5.1 Base Colors

```css
--background: #F7F8FA;
--surface: #FFFFFF;
--surface-muted: #F2F4F7;
--border: #E5E7EB;
--border-strong: #D0D5DD;

--text-primary: #111827;
--text-secondary: #4B5563;
--text-muted: #6B7280;
--text-disabled: #9CA3AF;

--sidebar-bg: #171717;
--sidebar-surface: #222222;
--sidebar-text: #E5E7EB;
--sidebar-muted: #A3A3A3;
```

### 5.2 Accent Colors

Keep accents minimal.

```css
--accent: #5B7CFA;
--accent-soft: #EEF2FF;
--success: #12B76A;
--success-soft: #ECFDF3;
--warning: #F79009;
--warning-soft: #FFFAEB;
--danger: #F04438;
--danger-soft: #FEF3F2;
--info: #2E90FA;
--info-soft: #EFF8FF;
```

### 5.3 Usage Rules

- Use accent color only for primary actions and active states.
- Use green for completed/on-track states.
- Use orange for upcoming deadlines.
- Use red only for overdue/rejected/error states.
- Do not use multiple saturated colors in the same card unless it is a chart.

---

## 6. Typography

Use a modern sans-serif.

Recommended:
- Inter
- Geist
- SF Pro
- System UI

### 6.1 Type Scale

```css
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;
```

### 6.2 Typography Rules

Page title:
- 20–24px
- 600 weight

Card title:
- 14–16px
- 500 or 600 weight

Metric number:
- 32–40px
- 400 or 500 weight
- Do not make it too bold

Body:
- 14px
- 400 weight
- 1.45 line-height

Muted helper text:
- 12–13px
- medium gray

---

## 7. Spacing and Radius

### 7.1 Spacing

Use an 8px spacing system.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
```

### 7.2 Radius

Asana-like soft rounded cards.

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
```

Rules:
- Cards: 12px
- Buttons: 8px
- Badges: 999px
- Modals: 16px
- Inputs: 8px

---

## 8. Component Style

### 8.1 Cards

Cards should be:
- White
- Thin gray border
- Rounded corners
- Minimal shadow or no shadow
- Clear header
- Generous padding

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}
```

Avoid heavy shadows. Use borders for structure.

### 8.2 Buttons

Primary:
- Accent background
- White text
- Medium weight
- 36–40px height

Secondary:
- White background
- Gray border
- Dark text

Ghost:
- Transparent
- Used in sidebars and tables

Danger:
- Red text or red background only for destructive actions

Button labels should be action-specific:
- “Tailor resume”
- “Save job”
- “Export PDF”
- “Mark as applied”

Avoid vague labels:
- “Submit”
- “Continue”
- “Generate” without context

### 8.3 Badges

Use badges for:
- Status
- Co-op term
- Location
- Work mode
- Match level
- Deadline urgency

Examples:
- On track
- Ready to apply
- Applied
- Interview
- 4-month
- Vancouver
- Hybrid
- International eligible

### 8.4 Tables

Tables should be clean and scannable.

Use:
- Sticky header when useful
- Row hover state
- Small badges
- Compact density
- Sortable columns
- Empty state when no data

Common columns:
- Company
- Role
- Status
- Deadline
- Resume version
- Match
- Last updated

### 8.5 Kanban Board

Application tracker should support board view.

Columns:
- Saved
- Tailoring
- Ready
- Applied
- Interview
- Offer
- Rejected

Cards should show:
- Company
- Role
- Deadline
- Location
- Resume version
- Small AI status indicator

### 8.6 Charts

Use simple dashboard charts:
- Donut chart for status distribution
- Bar chart for applications by week
- Line chart for response rate over time

Chart style:
- Minimal grid lines
- Muted labels
- One main accent color
- Green/orange/red only for status-specific meaning

---

## 9. Key Screens

## 9.1 Dashboard

Purpose:
Give the student a high-level overview of their job search.

Layout:

```text
Top row:
- Saved jobs
- Ready to apply
- Applied
- Interviews
- Overdue tasks

Middle:
- Application pipeline chart
- Upcoming deadlines
- AI recommended next actions

Bottom:
- Recent jobs
- Resume performance
- Weekly application activity
```

Dashboard cards:
- Metric cards like Asana
- Large number
- Small helper text
- Optional filter indicator

Example metric cards:
- Saved jobs: 18
- Ready to apply: 5
- Applications sent: 42
- Interviews: 3
- Overdue follow-ups: 1

AI next action card:
- “3 applications are ready to submit”
- “2 deadlines within 48 hours”
- “Your React resume version is performing best”

---

## 9.2 Jobs Page

Purpose:
Saved job database.

Views:
- Table
- Cards
- Calendar
- Saved filters

Filters:
- Role
- Company
- Location
- Term
- Remote/hybrid/on-site
- Co-op eligible
- Work authorization
- Deadline
- Match score

Primary action:
- Add job

Empty state:
“Save your first job posting to start tailoring your resume.”

---

## 9.3 Job Detail Page

Purpose:
Analyze a single job and decide whether to apply.

Layout:

```text
Main column:
- Job title
- Company
- Location
- Deadline
- Job description summary
- Responsibilities
- Requirements
- Keywords

Right panel:
- Estimated match
- Missing keywords
- Suggested resume version
- Tailor resume button
- Application status
```

AI sections:
- Summary
- Required skills
- Nice-to-have skills
- Work authorization notes
- Co-op term fit
- Resume suggestions

Trust labels:
- “AI analysis from job description”
- “Review before applying”

---

## 9.4 Resume Tailoring Workspace

This is the most important screen.

Purpose:
Help students adapt their resume without inventing false experience.

Layout:

```text
Left panel:
- Original resume / master profile

Center panel:
- Tailored resume draft
- Editable sections
- Before/after bullet comparison

Right panel:
- Job requirements
- Keyword checklist
- AI suggestions
- Export actions
```

UX rules:
- AI suggestions are not automatically accepted
- User can accept/reject each bullet
- Highlight changed words
- Show source experience for each generated bullet
- Warn when a suggestion may be unsupported

Labels:
- “Based on existing experience”
- “Needs confirmation”
- “Unsupported claim risk”

Actions:
- Accept suggestion
- Reject
- Edit manually
- Save version
- Export PDF
- Export DOCX

---

## 9.5 Application Tracker

Purpose:
Track every application from saved to offer/rejection.

Default view:
- Kanban board

Alternative views:
- Table
- Calendar
- Company list

Card data:
- Company
- Role
- Status
- Deadline
- Resume version
- Last action
- Next action

Status colors:
- Saved: gray
- Tailoring: blue
- Ready: purple/blue accent
- Applied: neutral
- Interview: green
- Offer: green
- Rejected: red/gray

---

## 9.6 Application Detail Page

Purpose:
Single source of truth for one application.

Sections:
- Job info
- Application status
- Resume version used
- Cover letter
- Notes
- Interview prep
- Timeline
- Follow-up reminders

Timeline examples:
- Job saved
- Resume tailored
- Applied
- Confirmation received
- Interview scheduled
- Follow-up sent

---

## 9.7 Onboarding

Purpose:
Collect enough context to personalize the product.

Steps:
1. School and program
2. Year and graduation date
3. Target roles
4. Co-op term
5. Work eligibility
6. Resume upload
7. First job posting

Keep onboarding short.  
Allow skipping.

Important fields:
- School
- Program
- Year
- Target roles
- Preferred cities
- Work authorization
- Resume

---

## 10. Empty States

Every empty state should:
- Explain what belongs here
- Show one primary action
- Include a small example

Examples:

### No jobs saved
“You haven’t saved any jobs yet. Add a job posting to analyze requirements, tailor your resume, and track your application.”

Button:
“Add first job”

### No resume uploaded
“Upload your master resume so AI can suggest role-specific edits based only on your real experience.”

Button:
“Upload resume”

### No applications
“Move saved jobs into your application tracker when you’re ready to apply.”

Button:
“View saved jobs”

---

## 11. Loading States

Use skeleton loading for:
- Dashboard cards
- Job detail
- Resume analysis
- Tables

For AI generation:
- Show progress steps

Example:
1. Reading job description
2. Comparing with resume
3. Finding relevant experience
4. Drafting suggestions
5. Checking for unsupported claims

Do not show a generic spinner for long AI tasks.

---

## 12. Error States

Error messages should be specific.

Bad:
“Something went wrong.”

Good:
“We couldn’t read this PDF. Try uploading a DOCX file or paste the resume text instead.”

Common errors:
- Failed PDF parsing
- Job URL could not be read
- AI generation failed
- Export failed
- Missing resume
- Missing job description

Always provide recovery action.

---

## 13. Motion

Use motion lightly.

Allowed:
- Sidebar collapse
- Card hover
- Modal open/close
- Toasts
- Kanban drag-and-drop
- AI suggestion reveal

Avoid:
- Large page transitions
- Excessive bouncing
- Constant animated gradients
- Distracting background effects

Motion duration:
- 120–200ms for small UI
- 200–300ms for modals

---

## 14. Accessibility

Requirements:
- Keyboard navigable
- Visible focus states
- Sufficient color contrast
- Do not rely on color alone for status
- Proper labels for inputs
- ARIA labels for icon buttons
- Error text connected to fields

Keyboard-first interactions:
- Command menu
- Quick add job
- Search
- Move application status
- Accept/reject AI suggestion

---

## 15. Responsive Behavior

Desktop-first, because resume editing and tracking are complex.

### Desktop
- Full sidebar
- Multi-column workspace
- Right AI panel

### Tablet
- Collapsible sidebar
- Right panel becomes drawer

### Mobile
- Bottom navigation or collapsed sidebar
- Jobs and applications are card-based
- Resume editor becomes step-by-step
- Avoid full three-panel editor on mobile

---

## 16. Copywriting Rules

Tone:
- Clear
- Direct
- Calm
- Useful

Avoid:
- Overhyped AI language
- Fake certainty
- Corporate jargon
- Long paragraphs

Use:
- “Tailor resume”
- “Review suggestions”
- “Save version”
- “Ready to apply”
- “Deadline tomorrow”
- “Follow up today”

Avoid:
- “Unlock your dream career”
- “AI magic”
- “Perfect resume”
- “Guaranteed results”

---

## 17. AI Safety and Trust UX

Resume tailoring must follow these rules:

1. Do not invent experience.
2. Do not fabricate metrics.
3. Do not claim tools, internships, awards, or projects the user did not provide.
4. Rephrase and emphasize only existing experience.
5. Ask for confirmation when uncertain.
6. Mark unsupported claims clearly.
7. Keep an audit trail of generated changes.

UI labels:
- “Supported by your resume”
- “Needs confirmation”
- “Potential unsupported claim”
- “Edited by you”

Resume export should show:
- Last edited date
- Source resume
- Target job
- Version name

---

## 18. Design Tokens

Use these as implementation defaults.

```ts
export const designTokens = {
  colors: {
    background: "#F7F8FA",
    surface: "#FFFFFF",
    surfaceMuted: "#F2F4F7",
    border: "#E5E7EB",
    borderStrong: "#D0D5DD",
    textPrimary: "#111827",
    textSecondary: "#4B5563",
    textMuted: "#6B7280",
    sidebarBg: "#171717",
    sidebarSurface: "#222222",
    sidebarText: "#E5E7EB",
    accent: "#5B7CFA",
    accentSoft: "#EEF2FF",
    success: "#12B76A",
    successSoft: "#ECFDF3",
    warning: "#F79009",
    warningSoft: "#FFFAEB",
    danger: "#F04438",
    dangerSoft: "#FEF3F2",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    xxl: "32px",
  },
  typography: {
    fontFamily: "Inter, Geist, system-ui, sans-serif",
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "20px",
    xxl: "24px",
  }
}
```

---

## 19. Recommended Tech UI Stack

Use:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Framer Motion for light motion
- Recharts for dashboard charts
- React Hook Form
- Zod
- TanStack Table
- DnD Kit for kanban drag-and-drop

---

## 20. Claude / Fable Implementation Prompt

Use this prompt when generating UI:

```text
Build a polished web app UI for a Canadian co-op application manager.

The product helps university students save internship/co-op job postings, tailor resumes to each job, and track applications.

Design direction:
- Inspired by Asana dashboard UI
- Dark left sidebar
- Clean white cards
- Light gray canvas
- Thin borders
- Soft rounded corners
- Productivity app, not generic AI SaaS
- Avoid purple gradient AI clichés
- Use shadcn/ui, Tailwind, Next.js, TypeScript
- Desktop-first
- Dense but readable
- Calm and professional

Core screens:
1. Dashboard
2. Jobs table
3. Job detail with AI analysis
4. Resume tailoring workspace
5. Application kanban tracker
6. Application detail page
7. Onboarding

Important UX:
- User should always know the next action
- AI suggestions must be reviewable, not auto-applied
- Resume edits must show before/after
- Include labels like “Based on your existing resume” and “Needs confirmation”
- Include empty, loading, error, and success states
- Use realistic dummy data for Canadian co-op students

Use the DESIGN.md rules exactly.
Generate production-quality components.
```

---

## 21. Quality Checklist

Before shipping a screen, check:

- Is the main action obvious?
- Does the page look organized at a glance?
- Are cards visually consistent?
- Are borders and spacing clean?
- Is the UI too colorful?
- Is AI clearly reviewable?
- Are empty states useful?
- Are errors recoverable?
- Does it work with keyboard?
- Would a student use this weekly during co-op search?
