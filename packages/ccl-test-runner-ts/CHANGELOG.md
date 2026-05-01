# ccl-test-runner-ts

## 0.3.0

### Minor Changes

- 0d93398: Add `delimiterMode` and `toplevelIndent` options to `ParseOptions`, enabling three new optional behaviors: `delimiter_prefer_spaced` (prefer ` =` over bare `=` as delimiter), `toplevel_indent_strip` (use baseline 0 so all indented lines are continuations), and `tabs_as_whitespace` (strip leading tab whitespace on continuation lines and convert embedded tabs to spaces in values). The test runner now derives and passes `ParseOptions` to parse functions based on test case behaviors, unlocking 41 previously-skipped behavior tests.
- bccbebc: Added a public `compose(entries1, entries2)` helper to `ccl-ts` for entry-level CCL composition.
  `ccl-test-runner-ts` now runs compose associativity and left/right identity property tests when `parse`, `compose`, and `build_hierarchy` are wired by an implementation.
- 27f7663: Add `filter` function to ccl-ts. Use it to filter parsed entries with a predicate, e.g. to remove comment lines:

  ```typescript
  import { parse, filter } from "ccl-ts";

  const result = parse(input);
  if (result.isOk) {
    const withoutComments = filter(result.value, (entry) => entry.key !== "/");
  }
  ```

  The ccl-test-runner-ts package now supports `filter` validation, enabling test suites to exercise filter behavior against the CCL test data.

- 0aa0249: Add `Indentation` type, `PrintOptions`, and `CanonicalFormatOptions` to support `indent_spaces`/`indent_tabs` output behavior. `print()` and `canonicalFormat()` now accept an optional `indentation` option (`"spaces"` or `"tabs"`) to control output indentation style. The test runner derives indent options from declared behaviors and passes them to print, canonical_format, and round_trip validation handlers.
- 211440d: Add support for loading implementation capabilities from a `ccl-config.yaml` file conforming to the `ccl-config-schema.json` schema from ccl-test-data. New exports: `loadConfigFile`, `loadConfigFileSync`, and `configFileToCapabilities`. The vitest integration's `CCLTestConfig` now accepts an optional `configPath` to load capabilities from YAML, with inline values taking precedence.
- 71c904e: Use structured concurrency patterns internally
- 1d0c192: Add `GetBoolOptions` and `GetListOptions` to `getBool` and `getList`. `getBool` now supports a `strict` option that limits valid values to "true"/"false" only. `getList` now supports a `coercion` option that wraps single string values into a one-element list. Both functions change signature from rest parameters (`...pathParts`) to an explicit array plus optional options object.
- bf67b7b: Default to version from .version file when no --version flag is passed. Add --latest flag to explicitly fetch the latest release, ignoring any pinned .version file.
- 9fb1c26: Export `SkipSummaryReporter` via new `ccl-test-runner-ts/vitest-reporter` subpath. Add `parse_indented` validation handler. Align behavior constant names with the ccl-test-data spec (`tabs_as_content`, `tabs_as_whitespace`, `delimiter_first_equals`, `delimiter_prefer_spaced`, `indent_spaces`, `indent_tabs`).

### Patch Changes

- ad1c4e7: Add `CrlfHandling` type and `crlfHandling` option to `ParseOptions`, allowing consumers to choose between `crlf_preserve_literal` (default) and `crlf_normalize_to_lf` when parsing. The test runner's `preprocessInput` now also normalizes CRLF for tests that require it, regardless of the implementation's primary behavior.
- 2027c2f: `ccl-download-tests --output ./dir` and `-o ./dir` now work correctly. Previously these failed with "Unknown command ./dir" — only the `--output=./dir` equals syntax worked.

## 0.2.0

### Minor Changes

- Add TypeScript test runner for CCL implementations _[`#528`](https://github.com/tylerbutler/tools-monorepo/pull/528) [`be38140`](https://github.com/tylerbutler/tools-monorepo/commit/be3814098f5c29d82eef6067a5247891dccb8d92) [@tylerbutler](https://github.com/tylerbutler)_
  - Vitest integration with declarative API for wiring up CCL implementations
  - Capability-based test filtering (functions, features, behaviors, variants)
  - CLI tool (`ccl-download-tests`) for downloading test data from GitHub releases
  - Custom vitest matchers for CCL test assertions
  - Schema validation with types derived from ccl-test-data JSON schema
  - Skip summary reporter for tracking unimplemented test cases
  - Bundled test data for offline/CI usage

- Add Result type support for typed access function validation _[`#563`](https://github.com/tylerbutler/tools-monorepo/pull/563) [`93cf171`](https://github.com/tylerbutler/tools-monorepo/commit/93cf171a3b435eb7be0ed044e55cab8873ddf223) [@tylerbutler](https://github.com/tylerbutler)_
  - Add `AccessError` type for typed access error handling
  - Re-export `Result`, `Ok`, `Err`, `ok`, `err` from true-myth
  - Update validation handlers to work with Result-returning implementations
  - Add true-myth as a dependency

- Add validation handlers for typed access functions _[`#556`](https://github.com/tylerbutler/tools-monorepo/pull/556) [`a5df733`](https://github.com/tylerbutler/tools-monorepo/commit/a5df7339ed47c350f4b69be1fd95ef9f183cf7ca) [@tylerbutler](https://github.com/tylerbutler)_
  - `handleGetStringValidation`: Validates getString function behavior
  - `handleGetIntValidation`: Validates getInt function behavior
  - `handleGetBoolValidation`: Validates getBool function behavior
  - `handleGetFloatValidation`: Validates getFloat function behavior
  - `handleGetListValidation`: Validates getList function behavior

  Handlers convert test data path arguments to variadic arguments for CCL implementations.

### Patch Changes

- Features are now metadata-only and no longer affect test filtering. Tests now run regardless of feature declarations, making it easier to see which tests pass or fail without needing to configure features upfront. _[`#558`](https://github.com/tylerbutler/tools-monorepo/pull/558) [`b8adf6c`](https://github.com/tylerbutler/tools-monorepo/commit/b8adf6c0048c6e9aa7653d2c5c64d02f74d211a0) [@tylerbutler](https://github.com/tylerbutler)_
- Add `toplevel_indent` behavior support for test filtering _[`#538`](https://github.com/tylerbutler/tools-monorepo/pull/538) [`d485ff9`](https://github.com/tylerbutler/tools-monorepo/commit/d485ff93255e16822961680be9b3e21c100e1bc9) [@tylerbutler](https://github.com/tylerbutler)_

  The test runner now supports the `toplevel_indent` behavior option which controls how indentation is handled for top-level entries. This enables implementations to specify whether they use `toplevel_indent_strip` (remove leading indentation) or `toplevel_indent_preserve` (keep original indentation) behavior.

<details><summary>Updated 1 dependency</summary>

<small>

</small>

- `dill-cli@0.4.1`

</details>
