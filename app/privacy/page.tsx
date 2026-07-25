import type { Metadata } from "next";

import {
  LegalSection,
  PublicLegalPage,
} from "@/components/legal/public-legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | InternshipBC",
  description: "How InternshipBC handles account, application, and AI data.",
};

export default function PrivacyPage() {
  return (
    <PublicLegalPage
      title="Privacy Policy"
      description="This page explains what InternshipBC stores, when information is sent to OpenAI, and the controls available today."
    >
      <LegalSection title="Information we store">
        <p>
          We store the account and authentication information needed to sign
          you in, including your email address and Supabase session records.
        </p>
        <p>
          When you use the workspace, we may store profile details, candidate
          evidence, confirmed resume fragments, private saved jobs and job
          descriptions, extracted job requirements, applications and their
          notes or timeline, tailoring-credit records, and immutable tailored
          resume versions.
        </p>
      </LegalSection>

      <LegalSection title="Private jobs and public postings">
        <p>
          Your raw job-description text stays private to your account. It is
          protected by owner-scoped access controls and is not published to the
          public job board.
        </p>
        <p>
          Public board entries are a separate reviewed collection. Saving a
          private job does not automatically publish it.
        </p>
      </LegalSection>

      <LegalSection title="Information sent to OpenAI">
        <p>
          When you choose Analyze and the live provider is enabled,
          InternshipBC sends the private job-description text to OpenAI to
          extract structured requirements.
        </p>
        <p>
          When you choose Generate for tailoring, InternshipBC sends job
          requirements and context together with the approved candidate source
          material needed for the request. That material can include your name,
          email, education, skills, structured candidate evidence, and
          confirmed manual resume fragments. Unconfirmed entry prose is not a
          tailoring source.
        </p>
        <p>
          OpenAI API requests use <code>store: false</code>. OpenAI states that
          API data is not used to train or improve its models unless the API
          organization explicitly opts in; InternshipBC does not implement
          such an opt-in. OpenAI may still keep abuse-monitoring logs containing
          customer content for up to 30 days by default, unless different
          approved controls or legal requirements apply.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and browser storage">
        <p>
          Supabase authentication uses cookies so the server can
          recognize your signed-in session. Before sign-up, the public
          onboarding flow can keep a draft job and lightweight profile in your
          browser&apos;s local storage. That device draft is not an authenticated
          account record until you choose to import it.
        </p>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>
          InternshipBC relies on Supabase for authentication and database
          storage, Vercel for application hosting, configured email and OAuth
          providers for sign-in, and OpenAI for the two AI operations described
          above. These providers process information needed to deliver their
          part of the service.
        </p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>
          Private account data has no general automatic expiry today. It
          remains until you remove a record through an available product
          control or delete your account from Settings. Some individual records
          cannot be removed while linked history must be preserved.
        </p>
        <p>
          Self-serve account deletion permanently removes your authenticated
          account and its private application data. Deleting an individual
          application or saved job, where permitted, does not delete your
          account or every related record.
        </p>
      </LegalSection>

      <LegalSection title="Policy changes">
        <p>
          We may revise this policy when the product or its data flows change.
          The effective date above identifies the current version.
        </p>
      </LegalSection>
    </PublicLegalPage>
  );
}
