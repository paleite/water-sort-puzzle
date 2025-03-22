"use client";

import dynamic from "next/dynamic";

const Artifact = dynamic(
  () => import("@/components/artifact").then((mod) => mod.WaterSortGame),
  { ssr: false },
);

export default function Home() {
  return (
    <main className="min-h-screen antialiased">
      <Artifact />
    </main>
  );
}
