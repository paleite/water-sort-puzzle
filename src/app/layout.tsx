import type { Metadata, Viewport } from "next";
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
  title: "Water Sort Puzzle",
  description: "A fun puzzle game about sorting colored liquids",
  manifest: "/water-sort-puzzle/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Water Sort Puzzle",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="/water-sort-puzzle/apple-touch-icon.png"
          rel="apple-touch-icon"
          sizes="180x180"
        />
        <link
          href="/water-sort-puzzle/favicon-32x32.png"
          rel="icon"
          sizes="32x32"
          type="image/png"
        />
        <link
          href="/water-sort-puzzle/favicon-16x16.png"
          rel="icon"
          sizes="16x16"
          type="image/png"
        />
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta content="default" name="apple-mobile-web-app-status-bar-style" />
        <meta content="#ffffff" name="theme-color" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-dvh touch-none overflow-hidden antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
