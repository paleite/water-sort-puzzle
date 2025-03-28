# CLAUDE.md - Development Guidelines

## Build/Lint/Test Commands

- `pnpm dev` - Run development server with turbopack
- `pnpm build` - Build the project
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm format` - Format code with Prettier
- `pnpm spellcheck` - Check spelling with cspell
- `pnpm start` - Start production server

## Code Style Guidelines

- Use function declarations for components: `function Component() {}`
- TypeScript: Use type imports with `import type`
- Component props should use boolean naming convention: `isVisible`, `hasChildren`, etc.
- Imports: Group React first, Next.js second, then other libraries alphabetically
- Use double quotes for strings, avoid template literals for simple strings
- Follow strict TypeScript rules (@tsconfig/strictest)
- Self-close components and HTML tags when empty
- Sort imports using simple-import-sort pattern
- Use tailwind classes with `cn()` utility for conditional styling
- Prefer nullish coalescing (`??`) over logical OR for null/undefined checks
- Implement proper error handling with toast notifications
- Maintain immutability when updating state objects and arrays
- Use Zustand for state management with persist middleware when appropriate
- Implement file structure: features within app/ directory, reusable UI in components/
- Keep functions pure and small with descriptive names
- Provide descriptive types for all function parameters and return values
- Never use direct DOM manipulation (avoid document.querySelector); use React state and refs
- Use controlled components for forms with React state (value + onChange pattern)
