# Cursor Rules (Legacy)

These are condensed rules from `.cursorrules`. They are broad and may not all apply to this repo.
Confirm the relevant dependencies and patterns in the codebase before applying.

## Core library preferences

- Prefer TanStack Query (react-query) for async data and caching; avoid `useEffect` + `fetch` for data loading.
- Validate all API responses and form inputs with Zod.
- Use Tailwind + ShadCN + `cn()` for styling; avoid inline styles.
- Use react-hook-form for forms.
- Use Zustand for client state that should not live in context.
- Prefer @ebay/nice-modal-react for modals.

## General coding style

- Avoid default exports (except Next.js pages).
- Favor immutable updates and array methods; avoid mutating data and `for` loops.
- Use nullish coalescing (`??`) for null/undefined defaults.
- Keep functions small, pure, and descriptive; prefer early returns.
- Use descriptive names for functions/booleans; rename when intent changes.

## Frontend conventions

- Use `"use client"` for interactive components.
- Use controlled components for forms.
- Use `cn()` for class composition; avoid string concatenation.
- Prefer short `@/*` imports.

## Project structure (treat as hints, not canonical)

- Feature work under `src/app/`; shared UI under `components/`.
- Hooks under `hooks/`, queries under `queries/`, schemas under `schemas/`, stores under `stores/`.

## Static export guidance (if applicable)

- Avoid server components, middleware, and server-side features.
- Prefer query params over dynamic routes.
- Fetch dynamic data client-side after hydration.
- Configure `next.config.ts` with `output: "export"` and `images.unoptimized: true`.

## Tooling and workflow

- Prefer pnpm; do not switch package managers mid-project.
- Use long CLI flags for generated commands.
- Do not manually edit lockfiles.
- Run typecheck/format in hooks or CI when applicable.

## Notes

- The full legacy guidance remains in `.cursorrules`.
- Some instructions reference tooling or libraries not present in this repo.
