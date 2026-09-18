import { LevelSelect } from "@/components/level-select/level-select";
import { LEVEL_INDEX } from "@/lib/water-sort/levels/levels.generated";

export default function LevelsPage() {
  return <LevelSelect levels={LEVEL_INDEX} />;
}
