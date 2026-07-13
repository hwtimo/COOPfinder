export type BoardSubmissionFormValues = {
  sourceUrl: string;
  title: string;
  companyName: string;
  location: string;
  term: string;
  workMode: string;
  deadline: string;
  keywords: string;
  submissionNote: string;
  rawText: string;
};

export type BoardSubmissionField = keyof BoardSubmissionFormValues;

export type BoardSubmissionActionState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors: Partial<Record<BoardSubmissionField, string>>;
  values: BoardSubmissionFormValues;
  result?: {
    boardJobId: string;
    jobPostingId: string;
    moderationStatus: "pending_review";
  };
};

export const EMPTY_BOARD_SUBMISSION_VALUES: BoardSubmissionFormValues = {
  sourceUrl: "",
  title: "",
  companyName: "",
  location: "",
  term: "",
  workMode: "",
  deadline: "",
  keywords: "",
  submissionNote: "",
  rawText: "",
};

export const INITIAL_BOARD_SUBMISSION_STATE: BoardSubmissionActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: EMPTY_BOARD_SUBMISSION_VALUES,
};
