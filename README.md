# CCL TypeScript

TypeScript packages for [CCL (Categorical Configuration Language)](https://ccl.tylerbutler.com).

## Packages

| Package | Description |
|---------|-------------|
| [`@tylerbu/ccl-ts`](./packages/ccl-ts) | Core TypeScript CCL parser implementation |
| [`@tylerbu/ccl-test-runner-ts`](./packages/ccl-test-runner-ts) | Test framework with vitest integration and CLI |
| [`@tylerbu/ccl-test-data`](./packages/ccl-test-data) | Test fixture package (JSON files) |
| [`@tylerbu/ccl-test-viewer`](./packages/ccl-test-viewer) | SvelteKit + Tauri visualization app |
| [`@tylerbu/ccl-docs`](./packages/ccl-docs) | Astro/Starlight documentation site |

## Development

### Prerequisites

- Node.js 18+
- pnpm 10+

### Setup

```bash
pnpm install
```

### Commands

```bash
pnpm build          # Build all packages
pnpm test           # Run tests
pnpm check          # Run format and lint checks
pnpm format         # Format code with Biome
pnpm lint           # Lint code with Biome
```

## License

MIT
