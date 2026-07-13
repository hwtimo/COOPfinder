"use client";

import { FormEvent, useRef, useState, useSyncExternalStore } from "react";
import { BellRing, Eraser, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  updateApplicationFollowUpAction,
  type UpdateApplicationFollowUpActionResult,
} from "../actions";

const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const DAY_IN_MS = 86_400_000;

type LocalDateTimeResult =
  | { status: "valid"; value: string }
  | { status: "invalid" | "ambiguous" };

function subscribeToHydration() {
  return () => {};
}

function pad(value: number, length = 2) {
  return value.toString().padStart(length, "0");
}

function persistedTimestampToLocalInput(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "";

  const base = `${pad(timestamp.getFullYear(), 4)}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}T${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:${pad(timestamp.getSeconds())}`;
  const milliseconds = timestamp.getMilliseconds();
  return milliseconds === 0 ? base : `${base}.${pad(milliseconds, 3)}`;
}

function localDateTimeToIso(value: string): LocalDateTimeResult {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return { status: "invalid" };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const millisecond = Number((match[7] ?? "").padEnd(3, "0"));

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return { status: "invalid" };
  }

  const wallTime = new Date(0);
  wallTime.setUTCFullYear(year, month - 1, day);
  wallTime.setUTCHours(hour, minute, second, millisecond);

  if (
    wallTime.getUTCFullYear() !== year ||
    wallTime.getUTCMonth() !== month - 1 ||
    wallTime.getUTCDate() !== day ||
    wallTime.getUTCHours() !== hour ||
    wallTime.getUTCMinutes() !== minute ||
    wallTime.getUTCSeconds() !== second
  ) {
    return { status: "invalid" };
  }

  const wallTimeMs = wallTime.getTime();
  const offsets = new Set<number>();
  for (const delta of [-2, -1, 0, 1, 2]) {
    offsets.add(new Date(wallTimeMs + delta * DAY_IN_MS).getTimezoneOffset());
  }

  const candidates = new Set<number>();
  for (const offset of offsets) {
    const candidate = new Date(wallTimeMs + offset * 60_000);
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day &&
      candidate.getHours() === hour &&
      candidate.getMinutes() === minute &&
      candidate.getSeconds() === second &&
      candidate.getMilliseconds() === millisecond
    ) {
      candidates.add(candidate.getTime());
    }
  }

  if (candidates.size === 0) return { status: "invalid" };
  if (candidates.size > 1) return { status: "ambiguous" };

  return {
    status: "valid",
    value: new Date([...candidates][0]).toISOString(),
  };
}

export function ApplicationFollowUpForm({
  applicationId,
  initialFollowUpDue,
}: {
  applicationId: string;
  initialFollowUpDue: string | null;
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const persistedFollowUpDue = initialFollowUpDue ?? "";
  const [draft, setDraft] = useState({
    forFollowUpDue: persistedFollowUpDue,
    value: "",
    dirty: false,
  });
  const [pending, setPending] = useState(false);
  const [result, setResult] =
    useState<UpdateApplicationFollowUpActionResult | null>(null);
  const draftMatchesPersisted =
    draft.forFollowUpDue === persistedFollowUpDue && draft.dirty;
  const followUpLocal = draftMatchesPersisted
    ? draft.value
    : hydrated && persistedFollowUpDue
      ? persistedTimestampToLocalInput(persistedFollowUpDue)
      : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    let submittedValue = "";
    if (followUpLocal) {
      if (!draftMatchesPersisted && persistedFollowUpDue) {
        submittedValue = persistedFollowUpDue;
      } else {
        const converted = localDateTimeToIso(followUpLocal);
        if (converted.status !== "valid") {
          setResult({
            status: "invalid_input",
            message:
              converted.status === "ambiguous"
                ? "This local time occurs twice. Choose a different time to avoid an ambiguous follow-up."
                : "Enter a valid local date and time before saving.",
          });
          return;
        }
        submittedValue = converted.value;
      }
    }

    submittingRef.current = true;
    setPending(true);
    setResult(null);

    try {
      const actionResult = await updateApplicationFollowUpAction(
        applicationId,
        submittedValue,
      );
      setResult(actionResult);
      if (
        actionResult.status === "updated" ||
        actionResult.status === "unchanged"
      ) {
        router.refresh();
      }
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  const successful =
    result?.status === "updated" || result?.status === "unchanged";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label
          htmlFor="application-follow-up"
          className="text-xs font-medium text-foreground"
        >
          Follow-up date and time
        </label>
        <input
          id="application-follow-up"
          type="datetime-local"
          step="0.001"
          value={followUpLocal}
          onInput={(event) => {
            setDraft({
              forFollowUpDue: persistedFollowUpDue,
              value: event.currentTarget.value,
              dirty: true,
            });
            setResult(null);
          }}
          disabled={pending}
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-md"
          disabled={pending || followUpLocal.length === 0}
          onClick={() => {
            setDraft({
              forFollowUpDue: persistedFollowUpDue,
              value: "",
              dirty: true,
            });
            setResult(null);
          }}
        >
          <Eraser className="size-4" aria-hidden />
          Clear
        </Button>
        <Button type="submit" className="h-9 rounded-md" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <BellRing className="size-4" aria-hidden />
          )}
          {pending ? "Saving..." : "Save follow-up"}
        </Button>
      </div>

      {result ? (
        <p
          role="status"
          className={cn(
            "rounded-md border px-3 py-2 text-xs leading-5",
            successful
              ? "border-success/20 bg-success-soft text-success"
              : "border-destructive/20 bg-destructive-soft text-destructive",
          )}
        >
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
