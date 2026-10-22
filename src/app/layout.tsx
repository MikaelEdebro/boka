import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boka",
  description: "Weekly time reporting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
