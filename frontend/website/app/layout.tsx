import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SAPTANGA Newsroom",
  description: "SAPTANGA Newsroom — verified reporting, published with provenance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900">
        <header className="border-b border-neutral-200 px-6 py-4">
          <a href="/" className="text-lg font-semibold tracking-tight">
            SAPTANGA Newsroom
          </a>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-200 px-6 py-4 text-sm text-neutral-500">
          SAPTANGA Newsroom — every story published here carries its sources and editorial
          status. This is a V1 foundation build; the story archive is not yet live.
        </footer>
      </body>
    </html>
  );
}
