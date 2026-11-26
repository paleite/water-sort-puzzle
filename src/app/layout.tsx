import "./globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { OfflineRegistration } from "@/components/app/offline-registration";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Water Sort",
  description: "A tactile color sorting puzzle game.",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest`,
};

export default function RootLayout({
  children,
}: Readonly<{children: React.ReactNode}>) {
  return (
    <html className={`${geist.variable} dark`} lang="en">
      <body className="font-sans antialiased">{children}<OfflineRegistration /></body>
    </html>
  );
}
