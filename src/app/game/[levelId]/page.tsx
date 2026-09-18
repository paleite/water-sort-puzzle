import { GameScreen } from "@/components/water-sort/game-screen";
import { LEVEL_IDS } from "@/lib/water-sort/levels/levels.generated";

export function generateStaticParams() {
  return LEVEL_IDS.map((levelId) => ({levelId}));
}

export default async function GamePage({
  params,
}: {
  params: Promise<{levelId: string}>;
}) {
  const {levelId} = await params;
  return <GameScreen levelId={levelId} />;
}
