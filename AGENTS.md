# Repository Guidelines

## Project Structure & Module Organization
- `src/hatx-service.ts`: Hatx REST client, caching defaults, and request helpers.
- `src/types.ts`: shared API response/request types; add new shapes here first.
- `src/index.ts`: single export surface; re-export new public APIs here.
- `dist/`: generated build output; never edit by hand. Run a clean build before publishing.

## Build, Test, and Development Commands
- `pnpm install`: install dependencies (required before first build).
- `pnpm build`: type-check and emit ESM bundles to `dist/` via `tsc -p tsconfig.json`.
- `pnpm clean`: drop `dist/` to ensure fresh builds.
- `pnpm format` / `pnpm format:check`: auto-format or verify formatting with Prettier.
- `pnpm test`: placeholder that currently fails; update this script when adding tests.

## Coding Style & Naming Conventions
- TypeScript strict mode is enabled; prefer explicit return types for exported functions.
- ESM only (`type: "module"`); use `import/export` and keep module paths explicit.
- Prettier governs formatting; keep its defaults (2-space indent) and rerun after edits.
- ESLint extends `@eslint/js` and `typescript-eslint`; semicolons are required (`semi: always`).
- Naming: camelCase for variables/functions, PascalCase for classes/types, uppercase snake case for constants.

## Testing Guidelines
- No active suite yet; add unit tests alongside code (e.g., `src/hatx-service.spec.ts` or `src/__tests__/hatx-service.spec.ts`).
- Favor small tests around request construction, caching behavior, and type guards.
- When tests are introduced, wire the runner into `pnpm test` and keep them deterministic (no live API calls).

## Commit & Pull Request Guidelines
- Follow the existing conventional-commit style with emojis: `feat: :sparkles: add X`, `refactor: :technologist: ...`, `docs: :memo: ...`.
- Use clear scopes when helpful (`feat(api): ...`); keep subjects in the imperative mood.
- PRs: include a brief summary of changes, linked issues or tickets, testing notes (`pnpm build`, future tests), and any API surface updates.
- Avoid committing `node_modules`; include generated `dist/` only when needed for published artifacts.
