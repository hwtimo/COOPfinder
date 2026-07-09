import { PageHeader } from "@/components/app/page-header";
import { CardSection } from "@/components/app/card-section";
import { currentUser } from "@/lib/mock";

export default function SettingsPage() {
  return (
    <div className="max-w-[960px] space-y-6">
      <PageHeader
        title="Settings"
        description="Profile, co-op term, and preferences."
      />
      <CardSection title="Profile" description="Used to personalize job matching.">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Name</dt>
            <dd className="mt-0.5 text-foreground">{currentUser.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">School</dt>
            <dd className="mt-0.5 text-foreground">{currentUser.school}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Program</dt>
            <dd className="mt-0.5 text-foreground">{currentUser.program}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Co-op term</dt>
            <dd className="mt-0.5 text-foreground">{currentUser.term}</dd>
          </div>
        </dl>
      </CardSection>
    </div>
  );
}
