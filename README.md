# Water Sort

A Water Sort puzzle game built from the `paleite/claude-artifact-repository` scaffold.

## Development

```bash
pnpm install
pnpm dev
```

Run unit tests:

```bash
pnpm test:unit
```

## Level tooling

Level generation is an offline authoring task. The generator is not part of the browser bundle and is not run by deployment CI.

The canonical authoring data lives in:

```text
levels/
├── manifest.json
├── 001.json
├── 002.json
└── ...
```

`manifest.json` defines explicit level membership and order. Each individual level file contains the full readable puzzle and generator/solver development metadata.

The browser does not load these JSON files. Runtime level data is compiled into the committed module:

```text
src/lib/water-sort/levels/levels.generated.ts
```

Do not edit that file manually. Regenerate it with:

```bash
pnpm compile:levels
```

Generate a new level set:

```bash
pnpm generate:levels -- \
  --count 30 \
  --seed 20260912
pnpm compile:levels
```

Append levels to the existing committed set:

```bash
pnpm generate:levels -- \
  --count 30 \
  --append \
  --seed 20260912
pnpm compile:levels
```

When `--append` is present, the generator automatically starts after the highest numeric level id. Use `--start-id` only when an explicit id range is required.

The default generator creates 14-vial regular levels from a uniform shuffle of 12 colors, capacity 4, and 2 empty vials. It rejects starting boards that already contain a completed vial, proves accepted candidates with bounded A*, replays the returned solution, and writes commit-ready files to `levels`.

Useful overrides:

```bash
pnpm generate:levels -- \
  --count 30 \
  --append \
  --colors 12 \
  --capacity 4 \
  --empty-vials 2 \
  --max-solver-states 250000 \
  --max-solver-seconds 12 \
  --maximum-attempts 1500 \
  --seed 20260912 \
  --output levels
```

Each generated level stores solver and structural metadata under `development`, including a versioned `difficultyScore` from `0` to `1`. Only runtime-required data is copied into `levels.generated.ts`: vial contents, capacity, optimal move count, and difficulty score.

Verify committed authoring levels:

```bash
pnpm verify:levels
```

Before committing generated levels:

```bash
pnpm compile:levels
git diff --exit-code -- src/lib/water-sort/levels/levels.generated.ts
pnpm verify:levels
pnpm typecheck
pnpm lint
git diff -- levels src/lib/water-sort/levels/levels.generated.ts
```

Deployment CI recompiles the runtime module and fails if the committed generated file is stale. CI never generates new puzzles.

## TODO

- [ ] Improve pouring animation.
- [ ] Add GA to A/B test which color scheme performs best.
