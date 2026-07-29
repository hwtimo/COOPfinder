"use client";

import { useActionState } from "react";
import { FileCheck2, Upload } from "lucide-react";

import {
  extractResumePdfAction,
  type ResumePdfUploadState,
} from "@/app/(app)/resumes/actions";
import { CardSection } from "@/components/app/card-section";
import { Button } from "@/components/ui/button";

const initialState: ResumePdfUploadState = { status: "idle", message: "" };

export function ResumePdfUpload() {
  const [state, formAction, pending] = useActionState(
    extractResumePdfAction,
    initialState,
  );

  return (
    <CardSection
      title="Upload resume PDF"
      description="Extract selectable text for the next onboarding step"
    >
      <div id="resume-upload" className="space-y-4 scroll-mt-24">
        <form action={formAction} className="grid gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="resume-pdf" className="text-sm font-medium">
              Resume PDF
            </label>
            <input
              id="resume-pdf"
              name="resume"
              type="file"
              accept=".pdf,application/pdf"
              required
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              PDF only, up to 5 MB and 25 pages. Scanned or image-only PDFs
              require OCR and are not supported.
            </p>
          </div>
          <div>
            <Button type="submit" disabled={pending} className="gap-1.5">
              <Upload aria-hidden />
              {pending ? "Extracting text..." : "Extract text"}
            </Button>
          </div>
        </form>

        {state.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}

        {state.status === "success" ? (
          <section
            aria-labelledby="resume-extraction-success"
            className="space-y-3 rounded-md border border-border bg-muted/30 p-4"
          >
            <div className="flex items-start gap-2">
              <FileCheck2
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-hidden
              />
              <div>
                <h3 id="resume-extraction-success" className="text-sm font-semibold">
                  Text extracted
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {state.message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.pageCount} {state.pageCount === 1 ? "page" : "pages"} ·{" "}
                  {state.characterCount.toLocaleString()} characters
                </p>
              </div>
            </div>
            <label htmlFor="resume-extracted-text" className="text-sm font-medium">
              Extracted text preview
            </label>
            <textarea
              id="resume-extracted-text"
              value={state.text}
              readOnly
              rows={10}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-5"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Profile drafting is not part of this step. No evidence was
              created or confirmed.
            </p>
          </section>
        ) : null}
      </div>
    </CardSection>
  );
}
