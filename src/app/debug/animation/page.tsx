import type { Metadata } from "next";

import { AnimationDebugLab } from "@/components/water-sort/animation-debug-lab";

export const metadata: Metadata = {
  title: "Animation Debug Lab · Water Sort",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AnimationDebugPage() {
  return <AnimationDebugLab />;
}
