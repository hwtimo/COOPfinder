"use client";

import Link from "next/link";
import { Compass, HardDrive } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadGuestDraft } from "@/lib/guest-draft/storage";
import {
  createEmptyGuestDraft,
  type GuestDraftV1,
} from "@/lib/guest-draft/types";
import {
  hasGuestMatchSignals,
  rankStarterJobs,
} from "@/lib/start/matching";
import type { PublicBoardJob } from "@/lib/board/types";

export function GuestDraftMatchNote({ job }: { job: PublicBoardJob }) {
  const [draft, setDraft] = useState<GuestDraftV1>(() =>
    createEmptyGuestDraft(),
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const result = loadGuestDraft();
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setDraft(result.draft);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const match = useMemo(
    () => rankStarterJobs(draft, [job])[0] ?? null,
    [draft, job],
  );

  if (!loaded) {
    return (
      <section className="rounded-lg border bg-card p-5" aria-label="Loading device draft match">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="mt-3 h-3 w-full rounded" />
        <Skeleton className="mt-2 h-3 w-4/5 rounded" />
      </section>
    );
  }

  if (!hasGuestMatchSignals(draft)) {
    return (
      <section className="rounded-lg border border-dashed bg-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <HardDrive className="size-4" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">
            Compare with your device draft
          </h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Add target roles, skills, or a work term to see a deterministic,
          directional note for this role. Job details remain public.
        </p>
        <Button variant="outline" className="mt-3 h-9 rounded-md" asChild>
          <Link href="/start#profile">Start your profile</Link>
        </Button>
      </section>
    );
  }

  const skillOverlap = match
    ? [...match.matchedRequiredSkills, ...match.matchedNiceToHaveSkills]
    : [];

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2">
        <Compass className="size-4 text-info" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">
          Directional match from your device draft
        </h2>
      </div>
      {match ? (
        <>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            This role surfaces from the profile signals saved in this browser.
            Matching uses structured overlap, not AI.
          </p>
          {skillOverlap.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {skillOverlap.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-medium text-info"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          This role does not currently surface from your draft signals. That is
          directional only; review the original posting and update your profile
          when useful.
        </p>
      )}
      <Link
        href="/start#profile"
        className="mt-3 inline-flex text-xs font-medium text-brand hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Update device draft
      </Link>
    </section>
  );
}
