---
"ccl-test-runner-ts": patch
---

Fixed `ccl-download-tests --output ./dir` (and `-o ./dir`) failing with "Unknown command ./dir". Space-separated option values now work correctly alongside the existing `--output=./dir` equals syntax.
