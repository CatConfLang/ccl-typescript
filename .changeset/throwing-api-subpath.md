---
"ccl-ts": minor
---

Add `ccl-ts/throwing` subpath export with standard JavaScript error handling (throw/catch) instead of true-myth Result types. The core parser now throws `CCLParseError` and `CCLAccessError` natively, so the throwing API is a zero-overhead re-export with no true-myth dependency in the bundle. The main `ccl-ts` entry point continues to return true-myth Results for backward compatibility.
