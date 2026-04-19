---
"ccl-test-runner-ts": patch
---

`ccl-download-tests --output ./dir` and `-o ./dir` now work correctly. Previously these failed with "Unknown command ./dir" — only the `--output=./dir` equals syntax worked.
