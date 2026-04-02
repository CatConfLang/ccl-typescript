---
"ccl-test-runner-ts": minor
---

Add support for loading implementation capabilities from a `ccl-config.yaml` file conforming to the `ccl-config-schema.json` schema from ccl-test-data. New exports: `loadConfigFile`, `loadConfigFileSync`, and `configFileToCapabilities`. The vitest integration's `CCLTestConfig` now accepts an optional `configPath` to load capabilities from YAML, with inline values taking precedence.
