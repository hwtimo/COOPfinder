import type { GetOwnedTailoredResumeVersionResult } from "@/lib/tailoring/get-owned-tailored-resume-version";

type ReadyVersion = Extract<
  GetOwnedTailoredResumeVersionResult,
  { status: "ready" }
>;

const documentSectionLabels = {
  education: "Education",
  experience: "Experience",
  project: "Projects",
  skills: "Skills",
  technologies: "Technologies",
  certifications: "Certifications",
  languages: "Languages",
  volunteer: "Volunteer experience",
} as const;

function CompleteDocument({ version }: { version: ReadyVersion }) {
  if (!("identity" in version.review)) return null;
  const { review } = version;
  const educationValues = [
    review.education.school,
    review.education.program,
    review.education.gradYear,
    review.education.coopTerm,
  ].filter(Boolean);

  return (
    <article
      aria-label={version.versionName}
      className="resume-print-surface mx-auto max-w-[816px] rounded-md border bg-white px-6 py-8 text-slate-950 shadow-sm sm:px-10 sm:py-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <div className="border-b border-slate-300 pb-5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {review.identity.fullName || "Tailored resume"}
        </h1>
        {review.identity.email ? (
          <p className="mt-2 break-all text-sm text-slate-600">
            {review.identity.email}
          </p>
        ) : null}
      </div>

      {educationValues.length > 0 ? (
        <section className="mt-6 break-inside-avoid" aria-labelledby="resume-education">
          <h2
            id="resume-education"
            className="border-b border-slate-300 pb-1 text-sm font-semibold uppercase tracking-[0.14em]"
          >
            Education
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-800">
            {educationValues.join(" · ")}
          </p>
        </section>
      ) : null}

      {review.sections.map((section, sectionIndex) => {
        if (
          section.type === "education" &&
          section.entries.length === 0 &&
          section.evidence.length === 0
        ) {
          return null;
        }
        return (
          <section
            key={`${section.type}:${sectionIndex}`}
            className="mt-6 break-inside-avoid-page"
            aria-labelledby={`resume-section-${sectionIndex}`}
          >
            <h2
              id={`resume-section-${sectionIndex}`}
              className="border-b border-slate-300 pb-1 text-sm font-semibold uppercase tracking-[0.14em]"
            >
              {documentSectionLabels[section.type]}
            </h2>
            <div className="mt-3 space-y-4">
              {section.entries.map((entry, entryIndex) => (
                <div
                  key={`${entry.heading}:${entryIndex}`}
                  className="break-inside-avoid"
                >
                  <h3 className="text-sm font-semibold">{entry.heading}</h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-800">
                    {entry.bullets.map((bullet) => (
                      <li key={`${bullet.entryId}:${bullet.fragmentId}`}>
                        {bullet.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {section.evidence.length > 0 ? (
                <ul className="flex flex-wrap gap-x-2 gap-y-1 text-sm leading-6 text-slate-800">
                  {section.evidence.map((item) => (
                    <li key={item.evidenceId}>
                      {item.term}
                      {item.languageProficiency
                        ? ` (${item.languageProficiency})`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        );
      })}
    </article>
  );
}

function OlderGeneratedContent({ version }: { version: ReadyVersion }) {
  if (!("jobHeading" in version.review)) return null;
  return (
    <article className="mx-auto max-w-3xl rounded-md border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">
        Older tailoring record
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {version.review.jobHeading.companyName} · {version.review.jobHeading.title}
      </p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        This older saved version contains a verified evidence plan, not a
        complete printable resume document.
      </p>
      {version.review.summaryEvidence.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {version.review.summaryEvidence.map((item, index) => (
            <li
              key={`${item.term}:${index}`}
              className="text-sm text-text-secondary"
            >
              {item.term} · {item.provenanceLabel}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function TailoredResumeReview({ version }: { version: ReadyVersion }) {
  return "identity" in version.review ? (
    <CompleteDocument version={version} />
  ) : (
    <OlderGeneratedContent version={version} />
  );
}
