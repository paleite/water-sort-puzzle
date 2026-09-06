import { GameScreen } from "@/components/water-sort/game-screen";
import manifest from "../../../../public/levels/manifest.json";

export function generateStaticParams() {
  return manifest.levels.map(({id}) => ({levelId: id}));
}

export default async function GamePage({
  params,
}: {
  params: Promise<{levelId: string}>;
}) {
  const {levelId} = await params;
  return <GameScreen levelId={levelId} />;
}
