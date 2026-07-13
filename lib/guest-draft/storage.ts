import {
  createEmptyGuestDraft,
  createLocalId,
  GUEST_DRAFT_STORAGE_KEY,
  INTAKE_INTENT_SESSION_KEY,
  INTAKE_INTENT_VERSION,
  type GuestDraftV1,
  type IntakeIntentV1,
  type JobIntakeType,
  type StashedGuestJob,
} from "./types";
import { normalizeGuestDraft } from "./normalize";

const INTAKE_INTENT_TTL_MS = 15 * 60 * 1000;

type StorageResult = {
  ok: boolean;
  error?: "unavailable" | "invalid";
};

export type GuestDraftLoadResult = {
  draft: GuestDraftV1;
  storageAvailable: boolean;
  recoveredFromInvalidData: boolean;
};

function getBrowserStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadGuestDraft(): GuestDraftLoadResult {
  const storage = getBrowserStorage("local");
  const fallback = createEmptyGuestDraft();

  if (!storage) {
    return {
      draft: fallback,
      storageAvailable: false,
      recoveredFromInvalidData: false,
    };
  }

  try {
    const raw = storage.getItem(GUEST_DRAFT_STORAGE_KEY);
    if (!raw) {
      return {
        draft: fallback,
        storageAvailable: true,
        recoveredFromInvalidData: false,
      };
    }

    const draft = normalizeGuestDraft(JSON.parse(raw));
    if (!draft) {
      return {
        draft: fallback,
        storageAvailable: true,
        recoveredFromInvalidData: true,
      };
    }

    return {
      draft,
      storageAvailable: true,
      recoveredFromInvalidData: false,
    };
  } catch {
    return {
      draft: fallback,
      storageAvailable: true,
      recoveredFromInvalidData: true,
    };
  }
}

export function saveGuestDraft(draft: GuestDraftV1): StorageResult {
  const storage = getBrowserStorage("local");
  if (!storage) return { ok: false, error: "unavailable" };

  try {
    storage.setItem(GUEST_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export function removeGuestDraft(): StorageResult {
  const storage = getBrowserStorage("local");
  if (!storage) return { ok: false, error: "unavailable" };

  try {
    storage.removeItem(GUEST_DRAFT_STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export function createStashedGuestJob(
  inputType: JobIntakeType,
  value: string,
  now = new Date(),
): StashedGuestJob {
  return {
    id: createLocalId("job"),
    inputType,
    ...(inputType === "url" ? { url: value } : { text: value }),
    addedAt: now.toISOString(),
  };
}

export function saveIntakeIntent(
  inputType: JobIntakeType,
  value: string,
  now = new Date(),
): StorageResult {
  const storage = getBrowserStorage("session");
  if (!storage) return { ok: false, error: "unavailable" };

  const intent: IntakeIntentV1 = {
    version: INTAKE_INTENT_VERSION,
    id: createLocalId("intake"),
    inputType,
    ...(inputType === "url" ? { url: value } : { text: value }),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INTAKE_INTENT_TTL_MS).toISOString(),
  };

  try {
    storage.setItem(INTAKE_INTENT_SESSION_KEY, JSON.stringify(intent));
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
