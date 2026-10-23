import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Geist_Mono, Inter } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { Nav } from "@/components/nav";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { CONTAINER } from "@/lib/layout";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Boka",
  description: "Weekly time reporting",
};

async function loadTheme() {
  "use cache";
  cacheLife("max");
  return getSettings(getDb()).theme;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await loadTheme();

  return (
    <html
      lang="sv"
      data-theme={theme}
      className={`h-full antialiased ${inter.variable} ${geistMono.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Suspense>
          <Nav />
        </Suspense>
        <main className={`${CONTAINER} flex-1 p-6`}>{children}</main>
        <Toaster position="bottom-right" theme={theme} />
      </body>
    </html>
  );
}
