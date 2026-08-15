import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medical Intelligence Control Surface",
  description: "Whole-body bilingual clinical decision support with safety routing, medical-source retrieval, nutrition education, and iOS measurements.",
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
