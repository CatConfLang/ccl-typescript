---
"ccl-ts": minor
---

Add configurable tab handling via new `ParseOptions` type with `tabHandling` option (defaults to `tabs_as_content`). New exports: `parse` and `buildHierarchy` now accept an optional `ParseOptions` parameter, and `parseIndented` is a new function for parsing with continuation line indentation normalization. New types `ParseOptions` and `TabHandling` are exported from the package.
