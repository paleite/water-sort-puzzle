import type { Metadata } from "next";

import { AnimationDebugLabSingleContext } from "@/components/water-sort/animation-debug-lab-single-context";

export const metadata: Metadata = {
  title: "Animation Debug Lab · Water Sort",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AnimationDebugPage() {
  return <AnimationDebugLabSingleContext />;
}
