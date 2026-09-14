import type { Metadata } from "next";

import { AnimationDebugLabSafe } from "@/components/water-sort/animation-debug-lab-safe";

export const metadata: Metadata = {
  title: "Animation Debug Lab · Water Sort",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AnimationDebugPage() {
  return <AnimationDebugLabSafe />;
}
