"use client";

import dynamic from "next/dynamic";

const Artifact = dynamic(() => import("@/components/artifact"), { ssr: false });

export default function Home() {
  return (
    <main className="min-h-screen antialiased">
      <Artifact />
    </main>
  );
}
