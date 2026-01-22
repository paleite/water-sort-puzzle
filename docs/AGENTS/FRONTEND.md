# Frontend Conventions

- Use function declarations for React components: `function Component() {}`.
- Component props use boolean naming like `isVisible`, `hasChildren`.
- Import order: React first, Next.js second, then other libraries alphabetically.
- Sort imports using the `simple-import-sort` pattern.
- Self-close empty components and HTML tags.
- Avoid direct DOM manipulation (e.g. `document.querySelector`); use React state/refs.
- Use controlled form components (`value` + `onChange`).
- Use `cn()` for conditional Tailwind classes.
- Use toast notifications for user-facing error handling.
