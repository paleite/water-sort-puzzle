"use client";

import { useEffect } from "react";
import { getAppHref, type AppDestination } from "@/lib/water-sort/navigation/app-location";

export function LegacyEntry({ destination }: { destination: AppDestination }) {
  const href = getAppHref(destination, process.env.NEXT_PUBLIC_BASE_PATH ?? "");
  useEffect(() => { window.location.replace(href); }, [href]);
  return <main className="grid min-h-dvh place-items-center"><a href={href}>Open Water Sort</a></main>;
}
