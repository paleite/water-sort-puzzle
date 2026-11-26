import { LegacyEntry } from "@/components/app/legacy-entry";
import { LEVEL_IDS } from "@/lib/water-sort/levels/levels.generated";

export function generateStaticParams() {
  return LEVEL_IDS.map((levelId) => ({ levelId }));
}

export default async function GamePage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = await params;
  return <LegacyEntry destination={{ kind: "game", levelId }} />;
}
