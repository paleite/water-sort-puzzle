import { LevelSelect } from "@/components/level-select/level-select";
import { LevelManifestSchema } from "@/lib/water-sort/levels/schemas";
import generatedManifest from "../../../public/levels/manifest.json";

export default function LevelsPage() {
  return (
    <LevelSelect manifest={LevelManifestSchema.parse(generatedManifest)} />
  );
}
