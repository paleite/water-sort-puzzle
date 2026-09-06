# Water Sort

A Water Sort puzzle game built from the `paleite/claude-artifact-repository` scaffold.

## Development

```bash
pnpm install
pnpm dev
```

## Level tooling

Generate verified static level JSON:

```bash
pnpm generate:levels -- \
  --count 100 \
  --colors 12 \
  --capacity 4 \
  --empty-vials 2 \
  --depth 80 \
  --beam-width 64 \
  --children-per-state 16 \
  --minimum-entropy 0.8 \
  --max-solver-states 2000000 \
  --seed 1 \
  --output public/levels
```

Verify committed levels:

```bash
pnpm verify:levels
```

The browser runtime only consumes `public/levels/*.json`; it does not ship or run the generator or solver.
