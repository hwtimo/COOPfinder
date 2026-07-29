import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

export const MAX_RESUME_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_PDF_PAGES = 25;
export const MAX_RESUME_TEXT_CHARACTERS = 100_000;
const PDF_EXTRACTION_TIMEOUT_MS = 10_000;

export type ResumePdfFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ResumePdfExtractionResult =
  | {
      status: "success";
      fileName: string;
      pageCount: number;
      text: string;
      characterCount: number;
    }
  | {
      status:
        | "invalid_file"
        | "file_too_large"
        | "too_many_pages"
        | "too_much_text"
        | "encrypted_pdf"
        | "no_extractable_text"
        | "unreadable_pdf";
    };

type ParsedPdf = {
  pageCount: number;
  text: string;
};

export type ResumePdfParser = (data: Uint8Array) => Promise<ParsedPdf>;

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPdfSignature(data: Uint8Array): boolean {
  return (
    data.length >= 5 &&
    data[0] === 0x25 &&
    data[1] === 0x50 &&
    data[2] === 0x44 &&
    data[3] === 0x46 &&
    data[4] === 0x2d
  );
}

function isEncryptedPdfError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return "name" in error && error.name === "PasswordException";
}

async function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error("resume_pdf_extraction_timeout")),
      PDF_EXTRACTION_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function parseResumePdfWithUnpdf(
  data: Uint8Array,
): Promise<ParsedPdf> {
  const document = await withTimeout(
    getDocumentProxy(data, {
      maxImageSize: 16_777_216,
      stopAtErrors: true,
    }),
  );

  try {
    if (document.numPages > MAX_RESUME_PDF_PAGES) {
      return { pageCount: document.numPages, text: "" };
    }
    const result = await withTimeout(extractText(document, { mergePages: true }));
    return { pageCount: result.totalPages, text: result.text };
  } finally {
    await document.cleanup().catch(() => undefined);
  }
}

export async function extractResumePdf(
  file: ResumePdfFile,
  parsePdf: ResumePdfParser = parseResumePdfWithUnpdf,
): Promise<ResumePdfExtractionResult> {
  if (
    file.type !== "application/pdf" ||
    !file.name.toLowerCase().endsWith(".pdf") ||
    !Number.isSafeInteger(file.size) ||
    file.size <= 0
  ) {
    return { status: "invalid_file" };
  }
  if (file.size > MAX_RESUME_PDF_BYTES) {
    return { status: "file_too_large" };
  }

  let data: Uint8Array;
  try {
    data = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { status: "unreadable_pdf" };
  }
  if (data.byteLength !== file.size || !isPdfSignature(data)) {
    return { status: "invalid_file" };
  }

  try {
    const parsed = await parsePdf(data);
    if (parsed.pageCount > MAX_RESUME_PDF_PAGES) {
      return { status: "too_many_pages" };
    }

    const text = normalizeExtractedText(parsed.text);
    if (!text) return { status: "no_extractable_text" };
    if (text.length > MAX_RESUME_TEXT_CHARACTERS) {
      return { status: "too_much_text" };
    }

    return {
      status: "success",
      fileName: file.name,
      pageCount: parsed.pageCount,
      text,
      characterCount: text.length,
    };
  } catch (error) {
    return {
      status: isEncryptedPdfError(error) ? "encrypted_pdf" : "unreadable_pdf",
    };
  }
}
