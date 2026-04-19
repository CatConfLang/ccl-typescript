---
"ccl-test-runner-ts": minor
---

Add `ccl-nutrition-label` CLI and `generateNutritionLabel` export that produce a markdown rollup from a CCL test results JSON document. Any implementation that emits schema-conformant results can generate a summary label for READMEs, PR comments, or scorecards.

Also fix `ccl-download-tests` to pull test data from the canonical `CatConfLang/ccl-test-data` repository instead of the stale `tylerbutler/ccl-test-data` mirror.
