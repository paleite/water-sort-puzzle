import "./globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Water Sort",
  description: "A tactile color sorting puzzle game.",
};

export default function RootLayout({
  children,
}: Readonly<{children: React.ReactNode}>) {
  return (
    <html className={geist.variable} lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
