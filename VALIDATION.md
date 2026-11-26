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

## Offline application

The root application shell owns home, level selection and game navigation. Old level URLs redirect to the shell. Production builds generate a content-versioned offline cache from exported assets; no level route prefetching is necessary.

Validate the production export at both the root and the deployed base path. On Chromium and WebKit, wait for the offline readiness indicator, disconnect, select levels, play and advance, reload, close and reopen, and exercise hint workers and all vial skins. Check that progress survives and no network request is necessary for level transitions. On reconnect, check that an updated worker waits for old tabs to close rather than replacing their cache during play. Browser storage may be evicted.

The browser integration test denies every request at the static origin after installation and verifies an uncached probe fails. Chromium additionally uses Playwright offline emulation; WebKit uses origin disconnection because offline emulation can reject service-worker responses. Browser-managed requests for the worker script may fail without compromising gameplay; all other unexpected origin requests fail the test with their paths. Both engines run independently in CI.
