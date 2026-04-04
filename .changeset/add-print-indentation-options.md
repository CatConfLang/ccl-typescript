---
"ccl-ts": minor
"ccl-test-runner-ts": minor
---

Add `Indentation` type, `PrintOptions`, and `CanonicalFormatOptions` to support `indent_spaces`/`indent_tabs` output behavior. `print()` and `canonicalFormat()` now accept an optional `indentation` option (`"spaces"` or `"tabs"`) to control output indentation style. The test runner derives indent options from declared behaviors and passes them to print, canonical_format, and round_trip validation handlers.
