import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const basePath =
  process.env.NODE_ENV === "production" ? "/water-sort-puzzle" : "";

export const metadata: Metadata = {
  title: "Water Sort Puzzle",
  description: "A fun puzzle game about sorting colored liquids",
  manifest: `${basePath}/manifest.json`,
  icons: {
    icon: [
      {
        url: `${basePath}/favicon-32x32.png`,
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: `${basePath}/favicon-16x16.png`,
        type: "image/png",
        sizes: "16x16",
      },
    ],
    apple: [
      {
        url: `${basePath}/apple-touch-icon.png`,
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
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
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta
          content="black-translucent"
          name="apple-mobile-web-app-status-bar-style"
        />
        <meta content="#060d1f" name="theme-color" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-dvh touch-none overflow-hidden antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
