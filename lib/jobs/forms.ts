import {
  PRIVATE_JOB_STATUSES,
  PRIVATE_JOB_WORK_AUTHORIZATIONS,
  PRIVATE_JOB_WORK_MODES,
  type PrivateJob,
  type PrivateJobStatus,
} from "./types";

export type PrivateJobFormValues = {
  sourceUrl: string;
  title: string;
  companyName: string;
  roleType: string;
  location: string;
  term: string;
  workMode: string;
  deadline: string;
  workAuthorization: string;
  notes: string;
  rawText: string;
  status: PrivateJobStatus;
  coopEligible: boolean;
};

export type PrivateJobFormField = keyof PrivateJobFormValues;

export type PrivateJobMutationState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: Partial<Record<PrivateJobFormField, string>>;
  values: PrivateJobFormValues;
  jobId?: string;
};

export type DeletePrivateJobState = {
  status: "idle" | "error";
  message: string;
};

export type SaveBoardJobState = {
  status: "idle" | "error" | "success";
  message: string;
  jobId?: string;
  alreadySaved?: boolean;
};

export const EMPTY_PRIVATE_JOB_FORM_VALUES: PrivateJobFormValues = {
  sourceUrl: "",
  title: "",
  companyName: "",
  roleType: "",
  location: "",
  term: "",
  workMode: "",
  deadline: "",
  workAuthorization: "",
  notes: "",
  rawText: "",
  status: "saved",
  coopEligible: true,
};

export const INITIAL_DELETE_PRIVATE_JOB_STATE: DeletePrivateJobState = {
  status: "idle",
  message: "",
};

export const INITIAL_SAVE_BOARD_JOB_STATE: SaveBoardJobState = {
  status: "idle",
  message: "",
};

export function privateJobToFormValues(job: PrivateJob): PrivateJobFormValues {
  return {
    sourceUrl: job.sourceUrl ?? "",
    title: job.title,
    companyName: job.companyName ?? "",
    roleType: job.roleType ?? "",
    location: job.location ?? "",
    term: job.term ?? "",
    workMode: job.workMode ?? "",
    deadline: job.deadline ?? "",
    workAuthorization: job.workAuthorization ?? "",
    notes: job.notes ?? "",
    rawText: job.rawText ?? "",
    status: job.status,
    coopEligible: job.coopEligible,
  };
}

export function initialPrivateJobMutationState(
  values = EMPTY_PRIVATE_JOB_FORM_VALUES,
): PrivateJobMutationState {
  return {
    status: "idle",
    message: "",
    fieldErrors: {},
    values,
  };
}

export function readPrivateJobFormValues(
  formData: FormData,
): PrivateJobFormValues {
  const value = (name: PrivateJobFormField) =>
    String(formData.get(name) ?? "").trim();

  const status = value("status");

  return {
    sourceUrl: value("sourceUrl"),
    title: value("title"),
    companyName: value("companyName"),
    roleType: value("roleType"),
    location: value("location"),
    term: value("term"),
    workMode: value("workMode"),
    deadline: value("deadline"),
    workAuthorization: value("workAuthorization"),
    notes: value("notes"),
    rawText: value("rawText"),
    status: PRIVATE_JOB_STATUSES.includes(status as PrivateJobStatus)
      ? (status as PrivateJobStatus)
      : "saved",
    coopEligible: formData.get("coopEligible") === "yes",
  };
}

export function isValidHttpUrl(value: string): boolean {
  if (!value || value.length > 2048) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validatePrivateJobFormValues(values: PrivateJobFormValues) {
  const fieldErrors: Partial<Record<PrivateJobFormField, string>> = {};

  if (values.sourceUrl && !isValidHttpUrl(values.sourceUrl)) {
    fieldErrors.sourceUrl = "Enter a valid http or https URL.";
  }
  if (!values.title || values.title.length > 200) {
    fieldErrors.title = "Enter a title between 1 and 200 characters.";
  }
  if (!values.companyName || values.companyName.length > 160) {
    fieldErrors.companyName = "Enter a company between 1 and 160 characters.";
  }
  if (values.roleType.length > 80) {
    fieldErrors.roleType = "Keep the role type to 80 characters or fewer.";
  }
  if (values.location.length > 160) {
    fieldErrors.location = "Keep the location to 160 characters or fewer.";
  }
  if (values.term.length > 120) {
    fieldErrors.term = "Keep the term to 120 characters or fewer.";
  }
  if (
    values.workMode &&
    !PRIVATE_JOB_WORK_MODES.includes(
      values.workMode as (typeof PRIVATE_JOB_WORK_MODES)[number],
    )
  ) {
    fieldErrors.workMode = "Choose a listed work mode.";
  }
  if (values.deadline && !isValidDate(values.deadline)) {
    fieldErrors.deadline = "Enter a valid deadline.";
  }
  if (
    values.workAuthorization &&
    !PRIVATE_JOB_WORK_AUTHORIZATIONS.includes(
      values.workAuthorization as (typeof PRIVATE_JOB_WORK_AUTHORIZATIONS)[number],
    )
  ) {
    fieldErrors.workAuthorization = "Choose a listed authorization note.";
  }
  if (values.notes.length > 5000) {
    fieldErrors.notes = "Keep notes to 5,000 characters or fewer.";
  }
  if (values.rawText.length > 100000) {
    fieldErrors.rawText = "Keep the job description to 100,000 characters or fewer.";
  }

  return fieldErrors;
}
