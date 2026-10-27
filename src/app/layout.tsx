import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// One family, two cuts: Inter's optical-size axis gives the tight "Display"
// cut automatically at headline sizes (see .font-display in globals.css)
// and the open text cut at 13px. JetBrains Mono for SHAs, routes, durations.
const sans = Inter({ subsets: ["latin"], axes: ["opsz"], variable: "--font-sans" });
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans text-[13px]">{children}</body>
    </html>
  );
}
