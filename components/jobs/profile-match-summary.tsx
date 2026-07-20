import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { OwnedJobMatchResult } from "@/lib/matching/get-owned-job-match";
import type {
  ComparableRequirementCategory,
  RequirementCoverageGroup,
  ResumeJobExactMatchResult,
  UnassessedRequirementCategory,
  WorkAuthorizationMatch,
} from "@/lib/matching/resume-job-match";

const MASTER_PROFILE_HREF = "/resumes/master";

const comparableCategoryLabels: Record<ComparableRequirementCategory, string> = {
  required_skill: "Skill",
  required_technology: "Technology",
  preferred_skill: "Skill",
  preferred_technology: "Technology",
  keyword: "Keyword",
  soft_skill: "Soft skill",
  certification: "Certification",
  language: "Language",
};

const unassessedCategoryLabels: Record<UnassessedRequirementCategory, string> = {
  education: "Education",
  experience: "Experience",
  responsibility: "Responsibilities",
  uncategorized_requirement: "Other requirements",
};

function RequirementItems({
  title,
  items,
}: {
  title: string;
  items: ReadonlyArray<{
    category: ComparableRequirementCategory;
    requirement: string;
  }>;
}) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li
              key={`${item.category}:${item.requirement}`}
              className="flex min-w-0 items-start gap-2 text-sm text-text-secondary"
            >
              <Badge
                variant="outline"
                className="mt-0.5 shrink-0 rounded-full font-normal"
              >
                {comparableCategoryLabels[item.category]}
              </Badge>
              <span className="min-w-0 break-words">{item.requirement}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">None</p>
      )}
    </div>
  );
}

function CoverageGroup({
  id,
  title,
  group,
}: {
  id: string;
  title: string;
  group: RequirementCoverageGroup;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-md border bg-background p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id={id}
          className="text-sm font-semibold text-foreground"
        >
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {group.matchedCount} of {group.totalUniqueRequirements} found
          {group.coveragePercentage === null
            ? null
            : ` · ${group.coveragePercentage}% coverage`}
        </p>
      </div>

      {group.totalUniqueRequirements === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No comparable requirements extracted
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <RequirementItems
            title="Found in your Master Profile"
            items={group.matchedItems}
          />
          <RequirementItems
            title="Not evidenced in your Master Profile"
            items={group.notEvidencedItems}
          />
        </div>
      )}
    </section>
  );
}

function WorkAuthorization({ match }: { match: WorkAuthorizationMatch }) {
  const content = {
    exact_match: {
      title: "Exact match found",
      description:
        "Your Master Profile work-authorization value exactly matches an analyzed job requirement.",
    },
    mismatch: {
      title: "No exact match found",
      description:
        "The analyzed job requirement and your Master Profile value differ. This does not determine eligibility.",
    },
    no_job_requirement: {
      title: "No job requirement extracted",
      description:
        "Work authorization was not included in the deterministic comparison.",
    },
    no_candidate_value: {
      title: "No Master Profile value",
      description:
        "Add an explicit work-authorization value to your Master Profile to compare it.",
    },
  }[match.status];

  return (
    <section aria-labelledby="profile-match-work-authorization">
      <h3
        id="profile-match-work-authorization"
        className="text-sm font-semibold text-foreground"
      >
        Work authorization
      </h3>
      <div className="mt-3 rounded-md border bg-background p-4">
        <p className="text-sm font-medium text-foreground">{content.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {content.description}
        </p>
        {match.status === "no_candidate_value" ? (
          <Link
            href={MASTER_PROFILE_HREF}
            className="mt-2 inline-flex rounded-sm text-sm font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Update Master Profile
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function DataLimitations({ match }: { match: ResumeJobExactMatchResult }) {
  const counts = new Map<UnassessedRequirementCategory, number>();
  for (const item of match.unassessedRequirements) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  const categorySummary = [...counts.entries()]
    .map(([category, count]) => `${unassessedCategoryLabels[category]} (${count})`)
    .join(", ");

  return (
    <section aria-labelledby="profile-match-data-limitations">
      <h3
        id="profile-match-data-limitations"
        className="text-sm font-semibold text-foreground"
      >
        Data limitations
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        This comparison uses exact, explicit skills, technologies, soft
        skills, certifications, languages, keywords, and work authorization
        from your Master Profile. It does not infer meaning from profile prose.
      </p>
      {match.dataCompleteness.unassessedJobRequirements > 0 ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {match.dataCompleteness.unassessedJobRequirements} analyzed job
          requirement
          {match.dataCompleteness.unassessedJobRequirements === 1 ? "" : "s"}
          {" could not be compared deterministically"}
          {categorySummary ? `: ${categorySummary}.` : "."}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No additional analyzed requirements were left unassessed.
        </p>
      )}
    </section>
  );
}

function MatchedSummary({ match }: { match: ResumeJobExactMatchResult }) {
  if (match.status === "insufficient_job_data") {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          No comparable job requirements
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The analyzed job does not yet contain comparable structured terms.
        </p>
        <div className="mt-4 border-t pt-4">
          <DataLimitations match={match} />
        </div>
      </div>
    );
  }

  if (match.status === "insufficient_candidate_data") {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          More Master Profile data needed
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Your Master Profile does not contain enough explicit skills or work
          authorization data for this comparison.
        </p>
        <Link
          href={MASTER_PROFILE_HREF}
          className="mt-3 inline-flex rounded-sm text-sm font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Update Master Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-3">
        <CoverageGroup
          id="profile-match-required"
          title="Required requirements"
          group={match.required}
        />
        <CoverageGroup
          id="profile-match-preferred"
          title="Preferred requirements"
          group={match.preferred}
        />
        <CoverageGroup
          id="profile-match-keywords"
          title="Keywords"
          group={match.keywords}
        />
      </div>
      <div className="grid gap-4 border-t pt-5 xl:grid-cols-3">
        <CoverageGroup
          id="profile-match-soft-skills"
          title="Soft skills"
          group={match.softSkills}
        />
        <CoverageGroup
          id="profile-match-certifications"
          title="Certifications"
          group={match.certifications}
        />
        <CoverageGroup
          id="profile-match-languages"
          title="Languages"
          group={match.languages}
        />
      </div>
      <div className="grid gap-5 border-t pt-5 lg:grid-cols-2">
        <WorkAuthorization match={match.workAuthorization} />
        <DataLimitations match={match} />
      </div>
    </div>
  );
}

export function ProfileMatchSummary({
  result,
}: {
  result: OwnedJobMatchResult;
}) {
  if (result.status === "matched") {
    return <MatchedSummary match={result.match} />;
  }

  if (result.status === "unauthenticated" || result.status === "not_found") {
    return null;
  }

  const message = {
    extraction_unavailable:
      "Complete job analysis before profile matching is available.",
    profile_unavailable:
      "Add explicit skills to your Master Profile before matching can be calculated.",
    invalid_extraction:
      "Profile matching is unavailable for this saved analysis.",
    unavailable:
      "Profile matching is temporarily unavailable. Your saved job and profile were not changed.",
  }[result.status];

  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-4">
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      {result.status === "profile_unavailable" ? (
        <Link
          href={MASTER_PROFILE_HREF}
          className="mt-2 inline-flex rounded-sm text-sm font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open Master Profile
        </Link>
      ) : null}
    </div>
  );
}
