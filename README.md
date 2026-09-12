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

Generate a new level set:

```bash
pnpm generate:levels -- \
  --count 30 \
  --seed 20260912
```

Append levels to the existing committed set:

```bash
pnpm generate:levels -- \
  --count 30 \
  --append \
  --seed 20260912
```

When `--append` is present, the generator automatically starts after the highest numeric level id. Use `--start-id` only when an explicit id range is required.

The default generator creates 14-vial regular levels from a uniform shuffle of 12 colors, capacity 4, and 2 empty vials. It rejects starting boards that already contain a completed vial, proves accepted candidates with bounded A*, replays the returned solution, and writes commit-ready files to `public/levels`.

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
  --output public/levels
```

Each newly generated level stores solver and structural metadata under `development`, including a versioned `difficultyScore` from `0` to `1`. The score uses optimal move count and log-scaled A* explored-state count. The current calibration maps the easiest and hardest observations from the 100-board uniform-shuffle experiment to the ends of the scale. The browser does not use this value yet.

Verify committed levels:

```bash
pnpm verify:levels
```

Before committing generated levels:

```bash
pnpm verify:levels
pnpm typecheck
pnpm lint
git diff -- public/levels
```

The browser runtime only consumes `public/levels/*.json`; it does not ship or run the generator or solver.

## TODO

- [ ] Improve pouring animation.
- [ ] Add GA to A/B test which color scheme performs best.
