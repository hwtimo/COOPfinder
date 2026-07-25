import type { Metadata } from "next";

import {
  LegalSection,
  PublicLegalPage,
} from "@/components/legal/public-legal-page";

export const metadata: Metadata = {
  title: "Terms of Use | InternshipBC",
  description: "Terms for using InternshipBC application-planning tools.",
};

export default function TermsPage() {
  return (
    <PublicLegalPage
      title="Terms of Use"
      description="InternshipBC helps you organize and review application materials. You remain responsible for every application you submit."
    >
      <LegalSection title="What InternshipBC does">
        <p>
          InternshipBC helps you save job information, compare structured job
          requirements with your profile, track applications, and prepare
          tailored resume versions for your review.
        </p>
        <p>
          InternshipBC does not apply to jobs automatically. You must review
          the original posting and submit your application on the
          employer&apos;s website or other original application service.
        </p>
      </LegalSection>

      <LegalSection title="Your responsibility">
        <p>
          You are responsible for the accuracy, completeness, and legality of
          the job, profile, resume, and application information you provide.
          Only submit information that you have the right to use.
        </p>
        <p>
          Review all extracted requirements, matches, generated resume
          materials, deadlines, and links before relying on them or sending
          them to an employer.
        </p>
      </LegalSection>

      <LegalSection title="AI and matching limitations">
        <p>
          AI output and deterministic matches can be incomplete or incorrect.
          They are drafting and comparison aids, not professional, legal,
          immigration, academic, or hiring advice.
        </p>
        <p>
          InternshipBC does not decide whether you are eligible or qualified
          and does not guarantee an interview, offer, employment outcome, or
          response from an employer.
        </p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>
          Employers, job boards, authentication providers, and other linked
          services have their own terms and privacy practices. InternshipBC
          does not control their content, availability, or hiring decisions.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          Features may be unavailable, changed, or withdrawn. You should keep
          your own copies of important application materials and verify current
          details at the original source.
        </p>
      </LegalSection>
    </PublicLegalPage>
  );
}
