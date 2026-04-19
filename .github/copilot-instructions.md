# Copilot Instructions

## Project Overview

TypeScript monorepo for CCL (Categorical Configuration Language) — a colon/equals-delimited configuration format with indentation-based nesting, multiline values, and typed accessors. The spec lives at <https://ccl.tylerbutler.com>.

### Package Dependency Graph

```
ccl-ts ← (core parser, published)
  ├── uses: true-myth (Result types for error handling)
  └── tested via: ccl-test-runner-ts + ccl-test-data

ccl-test-runner-ts ← (test framework, published)
  ├── provides: vitest integration (defineCCLTests), custom matchers, CLI
  ├── uses: ccl-test-data for fixtures
  └── uses: effection for structured concurrency

ccl-test-data ← (internal, not published)
  └── JSON test fixtures downloaded from external CCL test suite

ccl-test-viewer ← (internal, not published)
  └── SvelteKit + Tauri + Tailwind CSS visualization app
```

The documentation site (previously `packages/ccl-docs`) now lives in its own repo: <https://github.com/tylerbutler/ccl-website>.

## Build, Test, and Lint

This is a pnpm workspace monorepo orchestrated by Nx.

```bash
pnpm install              # Install dependencies
pnpm build                # Build all packages (nx run-many -t build)
pnpm test                 # Test all packages (nx run-many -t test)
pnpm check                # Format + lint check (biome check .)
pnpm format               # Auto-fix formatting (biome check . --write)
```

### Single-package commands

```bash
# Run from repo root using nx:
pnpm nx run ccl-ts:test
pnpm nx run ccl-ts:build:compile
pnpm nx run ccl-test-runner-ts:test

# Or cd into a package directory:
cd packages/ccl-ts && pnpm test
```

### Running a single test file

```bash
cd packages/ccl-ts && npx vitest run test/unit.test.ts
cd packages/ccl-ts && npx vitest run -t "test name pattern"
```

### Nx target chain

The `build` target depends on `build:compile` (tsc). The `test` target depends on `build:compile` then `test:vitest`. The `ci` target runs `build`, `test:coverage`, and `lint`. Nx caches results — use `pnpm nx reset` to clear the cache if needed.

## Key Conventions

### Error Handling with Result Types

All fallible functions in `ccl-ts` return `Result<T, E>` from the `true-myth` library instead of throwing. Check with `.isOk`/`.isErr` or use `.match()` for pattern matching. The error types are `ParseError` and `AccessError`.

### TypeScript Compilation

- Packages extend `config/tsconfig.strict.json` (which chains `@tsconfig/node18` → `@tsconfig/strictest`)
- Source lives in `src/`, compiles to `esm/` (ESM-only, NodeNext module resolution)
- All packages use `"type": "module"` — use `.js` extensions in import paths
- TypeScript project references connect packages; `build:compile` runs `tsc --project ./tsconfig.json`

### Biome (Formatting & Linting)

- Tabs for indentation, 100-char line width, double quotes
- `noDefaultExport: "error"` — default exports are banned except in config files (`.config.*`, `.mjs`, `.svelte`)
- `noUnusedImports: "error"` and `noUnusedVariables: "error"`
- `useImportType: "error"` — use `import type` for type-only imports

### CCL Test Framework Pattern

Tests for the ccl-ts parser use a data-driven approach via `ccl-test-runner-ts`:

1. Test fixtures come from `@tylerbu/ccl-test-data` (JSON files with inputs and expected outputs)
2. `defineCCLTests()` wires up implementation functions and declares capabilities (features, behaviors, variant)
3. The test runner auto-generates vitest test cases and skips tests for unimplemented functions

See `packages/ccl-ts/test/ccl.test.ts` for the canonical example.

### Changesets for Versioning

Uses `@changesets/cli` for version management. Add a changeset when making user-facing changes to published packages (`ccl-ts`, `ccl-test-runner-ts`):

```bash
pnpm changeset
```

### API Reports

Published packages use `@microsoft/api-extractor` to generate API reports in `api-docs/`. Run `pnpm build:api` in a package to update. API items use `@beta` release tags.

### Package Naming

Published packages use the `@tylerbu/` scope in some cases but not consistently — `ccl-ts` and `ccl-test-runner-ts` are unscoped. Internal packages use `@tylerbu/` scope.
