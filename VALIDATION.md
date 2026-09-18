# Validation

Run the generated-data check first:

```bash
pnpm compile:levels
git diff --exit-code -- src/lib/water-sort/levels/levels.generated.ts
```

A diff means the committed runtime level artifact is stale and must be regenerated and committed.

Then validate authored levels and application code:

```bash
pnpm verify:levels
pnpm typecheck
pnpm lint
pnpm spellcheck
pnpm test:unit
pnpm build
```

Level authoring data lives in `levels/`. The browser consumes the committed `src/lib/water-sort/levels/levels.generated.ts` module and should make no requests to `/levels/*.json`.
