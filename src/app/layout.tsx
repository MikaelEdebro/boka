import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { Nav } from "@/components/nav";
import { CONTAINER } from "@/lib/layout";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Boka",
  description: "Weekly time reporting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={`h-full antialiased ${inter.variable} ${geistMono.variable}`}>
      <body className="min-h-full flex flex-col font-sans">
        <Suspense>
          <Nav />
        </Suspense>
        <main className={`${CONTAINER} flex-1 p-6`}>{children}</main>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
