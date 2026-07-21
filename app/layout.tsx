import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const metadataBase = publicSiteUrl ? new URL(publicSiteUrl) : undefined;

export const metadata: Metadata = {
  metadataBase,
  alternates: metadataBase ? { canonical: "/" } : undefined,
  title: "COOPfinder",
  description:
    "Save co-op postings, tailor your resume, and track every application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        geistSans.variable,
        geistMono.variable,
      )}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
