# Validation performed in the implementation sandbox

The sandbox cannot resolve external package registries, so `pnpm install`, the full Next.js build, ESLint, and package-level typechecking could not be executed here.

The implementation was still validated as follows:

- Strict TypeScript compilation passed for the shared Water Sort domain, reverse generator, and A\* solver using the system TypeScript compiler.
- All 39 TypeScript/TSX source files passed TypeScript syntactic transpilation.
- The reverse generator was executed after compilation to JavaScript.
- 20 static 14-vial levels were generated and written to `public/levels`.
- Every generated level passed:
  - capacity validation
  - exact per-color count validation
  - A\* solution search
  - full solution replay through the shared `applyMove()` engine
  - stored optimal-move metadata comparison
- The generated pack currently uses capacity 4, 12 colors, 2 empty vials, and a reverse depth of 24. Each committed level has mean vial entropy approximately 1.372 and an independently verified 24-move solution.

After installing dependencies locally, run:

```bash
pnpm typecheck
pnpm lint
pnpm spellcheck
pnpm verify:levels
pnpm build
```
