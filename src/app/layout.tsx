import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Instrument Sans for the UI, its serif sibling for headline numbers and
// page titles only (one weight, used sparingly), JetBrains Mono for commit
// SHAs, routes and durations. All self-hosted by next/font, no npm dep.
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Nexus HQ",
  description: "Founder command center",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans text-[13px]">{children}</body>
    </html>
  );
}
