---
name: water-sort-level-generation
description: Generate, append, compile, and verify solvable canonical Water Sort levels in this repository.
---

# Water Sort level generation

Use this skill when adding generated puzzles to the canonical level pack. Manual puzzle design and gameplay changes are outside its scope.

## Workflow

1. Use the Node version in `.nvmrc` with `nvm use`; use `pnpm`.
2. Treat `levels/manifest.json` and its listed `levels/<id>.json` files as the canonical source. Runtime levels live in `src/lib/water-sort/levels/levels.generated.ts`.
3. Append new levels with an explicit count and seed:

   ```sh
   pnpm generate:levels -- --count 100 --append --seed 20261112
   ```

   Choose a suitable non-negative seed. `--append` finds the next IDs, avoids canonical-board duplicates against existing levels, solves each candidate, and preserves existing numeric level files. Without `--append`, the generator removes numeric JSON files in its output directory before writing the new pack; do not omit it when adding levels.

4. Compile runtime data with `pnpm compile:levels`. The compiler requires every JSON file in its input directory to be listed in the manifest. If unrelated JSON files are present (for example, legacy `level-*.json` files), compile from a temporary directory containing only `manifest.json` and the manifest-listed numeric level files:

   ```sh
   pnpm exec tsx scripts/water-sort/compile-levels.ts <clean-level-directory> src/lib/water-sort/levels/levels.generated.ts
   ```

5. Verify new or changed levels after committing them:

   ```sh
   pnpm verify:levels -- --changed-from HEAD^
   ```

   This checks board shape, duplicate boards, solvability, replay, and stored optimal move counts. Use `pnpm verify:levels` for a full-pack verification when requested.

6. Review the manifest, generated runtime index, level count, and staged paths. Keep unrelated working-tree files unstaged. Commit or push only when the user requests those actions.
