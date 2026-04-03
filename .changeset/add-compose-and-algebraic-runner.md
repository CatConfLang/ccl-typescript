---
"ccl-ts": minor
"ccl-test-runner-ts": minor
---

Added a public `compose(entries1, entries2)` helper to `ccl-ts` for entry-level CCL composition.
`ccl-test-runner-ts` now runs compose associativity and left/right identity property tests when `parse`, `compose`, and `build_hierarchy` are wired by an implementation.
