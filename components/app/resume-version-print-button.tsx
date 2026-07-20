"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ResumeVersionPrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="size-4" aria-hidden />
      Print / Save as PDF
    </Button>
  );
}
