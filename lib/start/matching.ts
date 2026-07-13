import type {
  GuestDraftV1,
  GuestWorkAuthorization,
} from "@/lib/guest-draft/types";
import type { PublicBoardJob } from "@/lib/board/types";

export type StarterJobMatch = {
  job: PublicBoardJob;
  score: number;
  matchedRequiredSkills: string[];
  matchedNiceToHaveSkills: string[];
  roleAligned: boolean;
  termAligned: boolean | null;
  workAuthorizationAligned: boolean | null;
};

const ROLE_ALIASES: Record<string, string[]> = {
  "Software engineering": [
    "software",
    "developer",
    "engineering",
    "frontend",
    "backend",
  ],
  "Embedded systems": ["embedded", "systems", "rtos", "hardware"],
  "Data and analytics": ["data", "analyst", "analytics", "dashboard"],
  "Cloud and platform": ["cloud", "platform", "devtools", "infrastructure"],
  "Full-stack development": ["full stack", "full-stack", "web development"],
  "QA and test automation": ["qa", "quality", "test", "testing", "automation"],
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[+#]/g, (character) => (character === "+" ? " plus " : " sharp "))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function phraseMatches(profileValue: string, jobValue: string): boolean {
  const profile = normalize(profileValue);
  const job = normalize(jobValue);
  if (!profile || !job) return false;

  const paddedProfile = ` ${profile} `;
  const paddedJob = ` ${job} `;

  return (
    profile === job ||
    paddedProfile.includes(` ${job} `) ||
    paddedJob.includes(` ${profile} `)
  );
}

function getProfileSkills(draft: GuestDraftV1): string[] {
  const allSkills = [
    ...draft.skills,
    ...draft.entries.flatMap((entry) => entry.skills),
  ];
  const seen = new Set<string>();

  return allSkills.filter((skill) => {
    const key = normalize(skill);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getRoleAlignment(
  targetRoles: string[],
  job: PublicBoardJob,
): boolean {
  if (targetRoles.length === 0) return false;

  const jobText = [job.title, ...job.keywords].join(" ");

  return targetRoles.some((targetRole) => {
    const aliases = ROLE_ALIASES[targetRole] ?? [targetRole];
    return aliases.some((alias) => phraseMatches(alias, jobText));
  });
}

function getTermAlignment(
  profileTerm: string | undefined,
  jobTerm: string | null,
) {
  if (!profileTerm || !jobTerm) return null;
  const profile = normalize(profileTerm);
  const job = normalize(jobTerm);
  const seasonYear = profile.match(/(fall|winter|spring|summer)\s+20\d{2}/)?.[0];
  const duration = profile.match(/(\d+)\s+(?:month|months|mo)/)?.[1];
  const seasonMatches = seasonYear ? job.includes(seasonYear) : true;
  const durationMatches = duration
    ? new RegExp(`\\b${duration}\\s+(?:month|months|mo)\\b`).test(job)
    : true;

  return seasonYear || duration
    ? seasonMatches && durationMatches
    : phraseMatches(profile, job);
}

function getWorkAuthorizationAlignment(
  profileValue: GuestWorkAuthorization | undefined,
  jobValue: PublicBoardJob["workAuthorization"],
): boolean | null {
  if (!profileValue || !jobValue) return null;
  if (jobValue === "International eligible") return true;
  if (profileValue === "International eligible") return false;

  return true;
}

export function rankStarterJobs(
  draft: GuestDraftV1,
  jobs: PublicBoardJob[],
): StarterJobMatch[] {
  const profileSkills = getProfileSkills(draft);
  const targetRoles = draft.profile.targetRoles ?? [];
  const hasMatchSignal = hasGuestMatchSignals(draft);

  if (!hasMatchSignal) return [];

  return jobs
    .filter((job) => job.status === "approved" && job.isActive)
    .map((job): StarterJobMatch | null => {
      const matchedRequiredSkills = job.requiredSkills.filter((skill) =>
        profileSkills.some((profileSkill) => phraseMatches(profileSkill, skill)),
      );
      const matchedNiceToHaveSkills = job.niceToHaveSkills.filter((skill) =>
        profileSkills.some((profileSkill) => phraseMatches(profileSkill, skill)),
      );
      const roleAligned = getRoleAlignment(targetRoles, job);
      const termAligned = getTermAlignment(draft.profile.coopTerm, job.term);
      const workAuthorizationAligned = getWorkAuthorizationAlignment(
        draft.profile.workAuthorization,
        job.workAuthorization,
      );

      if (termAligned === false || workAuthorizationAligned === false) {
        return null;
      }

      const requiredPoints = matchedRequiredSkills.length * 2;
      const niceToHavePoints = matchedNiceToHaveSkills.length;
      const rolePoints = targetRoles.length > 0 && roleAligned ? 3 : 0;
      const termPoints = termAligned === true ? 2 : 0;
      const workAuthorizationPoints = workAuthorizationAligned === true ? 1 : 0;
      const earnedPoints =
        requiredPoints +
        niceToHavePoints +
        rolePoints +
        termPoints +
        workAuthorizationPoints;
      const possiblePoints =
        job.requiredSkills.length * 2 +
        job.niceToHaveSkills.length +
        (targetRoles.length > 0 ? 3 : 0) +
        (draft.profile.coopTerm ? 2 : 0) +
        (draft.profile.workAuthorization ? 1 : 0);

      if (earnedPoints === 0 || possiblePoints === 0) return null;

      return {
        job,
        score: Math.round((earnedPoints / possiblePoints) * 100),
        matchedRequiredSkills,
        matchedNiceToHaveSkills,
        roleAligned,
        termAligned,
        workAuthorizationAligned,
      };
    })
    .filter((match): match is StarterJobMatch => match !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.job.companyName.localeCompare(right.job.companyName),
    );
}

export function hasGuestMatchSignals(draft: GuestDraftV1): boolean {
  return Boolean(
    draft.skills.length > 0 ||
      draft.entries.some((entry) => entry.skills.length > 0) ||
      draft.profile.targetRoles?.length ||
      draft.profile.coopTerm ||
      draft.profile.workAuthorization,
  );
}
