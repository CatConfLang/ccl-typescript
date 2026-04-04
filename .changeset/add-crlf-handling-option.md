---
"ccl-ts": minor
"ccl-test-runner-ts": patch
---

Add `CrlfHandling` type and `crlfHandling` option to `ParseOptions`, allowing consumers to choose between `crlf_preserve_literal` (default) and `crlf_normalize_to_lf` when parsing. The test runner's `preprocessInput` now also normalizes CRLF for tests that require it, regardless of the implementation's primary behavior.
