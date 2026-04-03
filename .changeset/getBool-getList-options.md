---
"ccl-ts": minor
"ccl-test-runner-ts": minor
---

Add `GetBoolOptions` and `GetListOptions` to `getBool` and `getList`. `getBool` now supports a `strict` option that limits valid values to "true"/"false" only. `getList` now supports a `coercion` option that wraps single string values into a one-element list. Both functions change signature from rest parameters (`...pathParts`) to an explicit array plus optional options object.
