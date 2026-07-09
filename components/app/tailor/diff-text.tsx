import { cn } from "@/lib/utils";

type DiffToken = { text: string; changed: boolean };

/**
 * Word-level diff via longest-common-subsequence.
 * Returns the tokens of `target` with `changed: true` for words that are
 * not part of the common subsequence with `other`.
 * Bullets are short (< ~40 words), so the O(n·m) table is fine.
 */
function diffWords(target: string, other: string): DiffToken[] {
  const a = target.split(/\s+/).filter(Boolean);
  const b = other.split(/\s+/).filter(Boolean);
  const m = a.length;
  const n = b.length;

  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      tokens.push({ text: a[i], changed: false });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      tokens.push({ text: a[i], changed: true });
      i++;
    } else {
      j++;
    }
  }
  while (i < m) {
    tokens.push({ text: a[i], changed: true });
    i++;
  }
  return tokens;
}

interface DiffTextProps {
  /** The text to render. */
  text: string;
  /** The text to compare against. */
  compareWith: string;
  /** "added" highlights new words; "removed" strikes out dropped words. */
  mode: "added" | "removed";
  className?: string;
}

/* DESIGN.md §9.4 — highlight changed words in before/after comparison */
export function DiffText({ text, compareWith, mode, className }: DiffTextProps) {
  const tokens = diffWords(text, compareWith);

  return (
    <span className={className}>
      {tokens.map((token, index) => (
        <span key={index}>
          {token.changed ? (
            <mark
              className={cn(
                "rounded-[3px] bg-transparent px-0.5 -mx-0.5",
                mode === "added"
                  ? "bg-brand-soft text-foreground"
                  : "text-muted-foreground line-through decoration-muted-foreground/60",
              )}
            >
              {token.text}
            </mark>
          ) : (
            token.text
          )}
          {index < tokens.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
