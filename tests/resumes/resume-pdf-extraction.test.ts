import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  extractResumePdf,
  MAX_RESUME_PDF_BYTES,
  parseResumePdfWithUnpdf,
  type ResumePdfFile,
} from "../../lib/resumes/resume-pdf-extraction";

function buildTextPdf(text: string): Uint8Array {
  const escaped = text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escaped}) Tj\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf));
}

function pdfFile(
  data: Uint8Array,
  overrides: Partial<ResumePdfFile> = {},
): ResumePdfFile {
  return {
    name: "resume.pdf",
    type: "application/pdf",
    size: data.byteLength,
    async arrayBuffer() {
      return data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ) as ArrayBuffer;
    },
    ...overrides,
  };
}

test("unpdf extracts selectable text from a valid PDF", async () => {
  const data = buildTextPdf("TypeScript resume evidence");
  const result = await parseResumePdfWithUnpdf(data);

  assert.deepEqual(result, {
    pageCount: 1,
    text: "TypeScript resume evidence",
  });
});

test("valid PDF extraction normalizes text without persisting or inferring", async () => {
  const data = buildTextPdf("placeholder");
  const result = await extractResumePdf(pdfFile(data), async () => ({
    pageCount: 2,
    text: "  TypeScript   developer \r\n\r\n\r\n Communication  ",
  }));

  assert.deepEqual(result, {
    status: "success",
    fileName: "resume.pdf",
    pageCount: 2,
    text: "TypeScript developer\n\nCommunication",
    characterCount: 35,
  });
});

test("rejects non-PDF, empty, oversized, and mislabeled inputs before parsing", async () => {
  const data = buildTextPdf("resume");
  let parserCalls = 0;
  const parser = async () => {
    parserCalls += 1;
    return { pageCount: 1, text: "resume" };
  };

  assert.deepEqual(
    await extractResumePdf(pdfFile(data, { type: "text/plain" }), parser),
    { status: "invalid_file" },
  );
  assert.deepEqual(
    await extractResumePdf(pdfFile(data, { name: "resume.txt" }), parser),
    { status: "invalid_file" },
  );
  assert.deepEqual(
    await extractResumePdf(pdfFile(data, { size: 0 }), parser),
    { status: "invalid_file" },
  );
  assert.deepEqual(
    await extractResumePdf(
      pdfFile(data, { size: MAX_RESUME_PDF_BYTES + 1 }),
      parser,
    ),
    { status: "file_too_large" },
  );
  assert.deepEqual(
    await extractResumePdf(pdfFile(new Uint8Array([1, 2, 3, 4, 5])), parser),
    { status: "invalid_file" },
  );
  assert.equal(parserCalls, 0);
});

test("returns honest scanned, page-limit, encrypted, and malformed states", async () => {
  const data = buildTextPdf("resume");

  assert.deepEqual(
    await extractResumePdf(pdfFile(data), async () => ({
      pageCount: 1,
      text: " \n ",
    })),
    { status: "no_extractable_text" },
  );
  assert.deepEqual(
    await extractResumePdf(pdfFile(data), async () => ({
      pageCount: 26,
      text: "resume",
    })),
    { status: "too_many_pages" },
  );
  assert.deepEqual(
    await extractResumePdf(pdfFile(data), async () => {
      const error = new Error("not returned");
      error.name = "PasswordException";
      throw error;
    }),
    { status: "encrypted_pdf" },
  );
  assert.deepEqual(
    await extractResumePdf(pdfFile(data), async () => {
      throw new Error("raw parser details");
    }),
    { status: "unreadable_pdf" },
  );
});

test("upload action authenticates and has no persistence or provider path", () => {
  const action = readFileSync("app/(app)/resumes/actions.ts", "utf8");
  const extractor = readFileSync(
    "lib/resumes/resume-pdf-extraction.ts",
    "utf8",
  );

  assert.match(action, /await getSupabaseUser\(\)/);
  assert.match(extractor, /from "unpdf"/);
  assert.doesNotMatch(
    `${action}\n${extractor}`,
    /\.from\(|\.rpc\(|storage|upload\(|insert\(|update\(|upsert\(|openai|provider|confirmed:\s*true/i,
  );
});
