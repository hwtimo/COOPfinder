import Link from "next/link";

import { CardSection } from "@/components/app/card-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ComparableRequirementCategory } from "@/lib/matching/resume-job-match";
import type { OwnedTailoringPreflightResult } from "@/lib/tailoring/get-owned-tailoring-preflight";
import type {
  TailoringMatchedEvidence,
  TailoringPreflightPackage,
} from "@/lib/tailoring/tailoring-preflight";

const categoryLabels: Record<ComparableRequirementCategory, string> = {
  required_skill: "Required skill",
  preferred_skill: "Preferred skill",
  required_technology: "Required technology",
  preferred_technology: "Preferred technology",
  soft_skill: "Soft skill",
  certification: "Certification",
  language: "Language",
  keyword: "Keyword",
};

const unassessedLabels: Record<string, string> = {
  education: "Education",
  experience: "Experience",
  responsibility: "Responsibilities",
  uncategorized_requirement: "Other requirements",
};

function EvidenceGroup({
  title,
  items,
}: {
  title: string;
  items: readonly TailoringMatchedEvidence[];
}) {
  return (
    <section className="rounded-md border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={`${item.requirement}:${item.matchedCandidateTerm}`}
              className="text-sm text-text-secondary"
            >
              <span className="font-medium text-foreground">
                {item.requirement}
              </span>
              <span className="text-muted-foreground">
                {` · verified as ${item.matchedCandidateTerm}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No verified matches in this category.
        </p>
      )}
    </section>
  );
}

function WorkAuthorization({
  preflight,
}: {
  preflight: TailoringPreflightPackage;
}) {
  const content = {
    exact_match: {
      title: "Exact match found",
      description:
        "The explicit Master Profile value exactly matches an analyzed job requirement.",
    },
    mismatch: {
      title: "No exact match found",
      description:
        "The values differ. This is context only and does not determine eligibility.",
    },
    no_job_requirement: {
      title: "No job requirement extracted",
      description: "Work authorization is not part of this comparison.",
    },
    no_candidate_value: {
      title: "No Master Profile value",
      description:
        "Add an explicit work-authorization value before future tailoring uses it.",
    },
  }[preflight.workAuthorization.status];

  return (
    <section aria-labelledby="tailoring-preflight-work-authorization">
      <h3
        id="tailoring-preflight-work-authorization"
        className="text-sm font-semibold text-foreground"
      >
        Work authorization
      </h3>
      <div className="mt-3 rounded-md border bg-background p-4">
        <p className="text-sm font-medium text-foreground">{content.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {content.description}
        </p>
      </div>
    </section>
  );
}

function ReadyPreflight({ preflight }: { preflight: TailoringPreflightPackage }) {
  const evidenceGroups = [
    ["Required skills", preflight.matched.requiredSkills],
    ["Preferred skills", preflight.matched.preferredSkills],
    ["Required technologies", preflight.matched.requiredTechnologies],
    ["Preferred technologies", preflight.matched.preferredTechnologies],
    ["Soft skills", preflight.matched.softSkills],
    ["Certifications", preflight.matched.certifications],
    ["Languages", preflight.matched.languages],
    ["Keywords", preflight.matched.keywords],
  ] as const;

  return (
    <div className="space-y-5">
      {preflight.readiness !== "ready" ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-4">
          <h2 className="text-sm font-semibold text-foreground">
            {preflight.readiness === "insufficient_job_data"
              ? "Comparable job information is limited"
              : "More Master Profile evidence is needed"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {preflight.readiness === "insufficient_job_data"
              ? "The saved analysis does not contain enough comparable structured requirements for a complete preflight."
              : "Add explicit evidence to your Master Profile before future tailoring can use it."}
          </p>
        </div>
      ) : null}

      <CardSection
        title="Evidence that can be emphasized"
        description="Verified in your Master Profile and supported by exact deterministic matching."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {evidenceGroups.map(([title, items]) => (
            <EvidenceGroup key={title} title={title} items={items} />
          ))}
        </div>
      </CardSection>

      <CardSection
        title="Supporting evidence"
        description="Confirmed profile sources are referenced narrowly; entry prose is not included."
      >
        {preflight.supportingEvidence.length > 0 ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {preflight.supportingEvidence.map((reference, index) => (
              <li
                key={`${reference.sourceType}:${reference.displayTitle}:${index}`}
                className="rounded-md border bg-background p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {reference.displayTitle}
                  </p>
                  {reference.profileSection ? (
                    <Badge variant="outline" className="rounded-full font-normal">
                      {reference.profileSection}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  {reference.matchedTerms.join(", ")}
                  {reference.languageProficiency
                    ? ` · ${reference.languageProficiency}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No supporting evidence references are available.
          </p>
        )}
      </CardSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <CardSection
          title="Not evidenced in your Master Profile"
          description="These requirements will not be added as candidate claims."
        >
          {preflight.notEvidenced.length > 0 ? (
            <ul className="space-y-2">
              {preflight.notEvidenced.map((item) => (
                <li
                  key={`${item.category}:${item.requirement}`}
                  className="flex min-w-0 items-start gap-2 text-sm text-text-secondary"
                >
                  <Badge
                    variant="outline"
                    className="mt-0.5 shrink-0 rounded-full font-normal"
                  >
                    {categoryLabels[item.category]}
                  </Badge>
                  <span className="min-w-0 break-words">{item.requirement}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No comparable requirements are currently marked not evidenced.
            </p>
          )}
          <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
            Update your Master Profile if you have one of these qualifications.
          </p>
        </CardSection>

        <CardSection
          title="Unassessed requirements"
          description="Deterministic comparison is not yet available for these categories."
        >
          {preflight.unassessed.categories.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {preflight.unassessed.categories.map((item) => (
                <li key={item.category}>
                  <Badge variant="outline" className="rounded-full font-normal">
                    {unassessedLabels[item.category] ?? item.category} ({item.count})
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No additional requirement categories remain unassessed.
            </p>
          )}
        </CardSection>
      </div>

      <CardSection title="Safety and next step">
        <div className="grid gap-5 lg:grid-cols-2">
          <WorkAuthorization preflight={preflight} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Evidence boundary
            </h3>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Tailoring will not invent qualifications that are not supported by
              your Master Profile.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Generation uses only approved Master Profile bullets and
              structured evidence shown in this preflight.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 h-9">
              <Link href="/resumes/master">Update Master Profile</Link>
            </Button>
          </div>
        </div>
      </CardSection>
    </div>
  );
}

export function TailoringPreflightSummary({
  result,
}: {
  result: OwnedTailoringPreflightResult;
}) {
  if (
    result.status === "ready" ||
    result.status === "insufficient_job_data" ||
    result.status === "insufficient_candidate_data"
  ) {
    return <ReadyPreflight preflight={result.preflight} />;
  }

  if (result.status === "unauthenticated" || result.status === "not_found") {
    return null;
  }

  const message = {
    extraction_unavailable:
      "Complete job analysis before a tailoring preflight can be shown.",
    profile_unavailable:
      "Your Master Profile could not be prepared for tailoring preflight.",
    invalid_extraction:
      "Tailoring preflight is unavailable for this saved analysis.",
    unavailable:
      "Tailoring preflight is temporarily unavailable. No saved data was changed.",
  }[result.status];

  return (
    <CardSection title="Tailoring preflight">
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      {result.status === "profile_unavailable" ? (
        <Button asChild variant="outline" size="sm" className="mt-4 h-9">
          <Link href="/resumes/master">Update Master Profile</Link>
        </Button>
      ) : null}
    </CardSection>
  );
}
