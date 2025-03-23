"use client";

import { useEffect } from "react";

import dynamic from "next/dynamic";

import { registerServiceWorker } from "./sw-register";

const Artifact = dynamic(
  () => import("@/components/artifact").then((mod) => mod.WaterSortGame),
  { ssr: false },
);

export default function Home() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <main className="min-h-screen antialiased">
      <Artifact />
    </main>
  );
}
