# ccl-ts

## 0.3.0

### Minor Changes

- 0d93398: Add `delimiterMode` and `toplevelIndent` options to `ParseOptions`, enabling three new optional behaviors: `delimiter_prefer_spaced` (prefer ` =` over bare `=` as delimiter), `toplevel_indent_strip` (use baseline 0 so all indented lines are continuations), and `tabs_as_whitespace` (strip leading tab whitespace on continuation lines and convert embedded tabs to spaces in values). The test runner now derives and passes `ParseOptions` to parse functions based on test case behaviors, unlocking 41 previously-skipped behavior tests.
- bccbebc: Added a public `compose(entries1, entries2)` helper to `ccl-ts` for entry-level CCL composition.
  `ccl-test-runner-ts` now runs compose associativity and left/right identity property tests when `parse`, `compose`, and `build_hierarchy` are wired by an implementation.
- ad1c4e7: Add `CrlfHandling` type and `crlfHandling` option to `ParseOptions`, allowing consumers to choose between `crlf_preserve_literal` (default) and `crlf_normalize_to_lf` when parsing. The test runner's `preprocessInput` now also normalizes CRLF for tests that require it, regardless of the implementation's primary behavior.
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
- 9fb1c26: Add configurable tab handling via new `ParseOptions` type with `tabHandling` option (defaults to `tabs_as_content`). New exports: `parse` and `buildHierarchy` now accept an optional `ParseOptions` parameter, and `parseIndented` is a new function for parsing with continuation line indentation normalization. New types `ParseOptions` and `TabHandling` are exported from the package.
- 1d0c192: Add `GetBoolOptions` and `GetListOptions` to `getBool` and `getList`. `getBool` now supports a `strict` option that limits valid values to "true"/"false" only. `getList` now supports a `coercion` option that wraps single string values into a one-element list. Both functions change signature from rest parameters (`...pathParts`) to an explicit array plus optional options object.
- e88999b: Add `ccl-ts/throwing` subpath export with standard JavaScript error handling (throw/catch) instead of true-myth Result types. The core parser now throws `CCLParseError` and `CCLAccessError` natively, so the throwing API is a zero-overhead re-export with no true-myth dependency in the bundle. The main `ccl-ts` entry point continues to return true-myth Results for backward compatibility.

## 0.2.0

### Minor Changes

- Add TypeScript implementation of CCL (Categorical Configuration Language) _[`#538`](https://github.com/tylerbutler/tools-monorepo/pull/538) [`d485ff9`](https://github.com/tylerbutler/tools-monorepo/commit/d485ff93255e16822961680be9b3e21c100e1bc9) [@tylerbutler](https://github.com/tylerbutler)_

  **Core parsing:**
  - `parse()` converts CCL text into flat Entry arrays
  - `buildHierarchy()` transforms flat entries into nested CCLObject structures
  - Support for comments, continuation lines, and indentation-based nesting
  - Full TypeScript type definitions for Entry, CCLObject, and CCLValue types

  **Typed access functions:**
  - `getString()`: Extract string values with type validation
  - `getInt()`: Parse integer strings with strict validation
  - `getBool()`: Parse boolean strings (true/false, case-insensitive)
  - `getFloat()`: Parse floating-point strings with validation
  - `getList()`: Access list values with automatic empty-key list detection

  All functions use variadic path arguments for navigation (e.g., `getString(obj, "server", "host")`).

  **Result types:**
  All fallible functions return `Result<T, E>` instead of throwing exceptions, using the true-myth library. Re-exports `ok`, `err`, `Result`, `Ok`, and `Err` for convenience.
