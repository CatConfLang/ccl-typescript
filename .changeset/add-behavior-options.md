---
"ccl-ts": minor
"ccl-test-runner-ts": minor
---

Add `delimiterMode` and `toplevelIndent` options to `ParseOptions`, enabling three new optional behaviors: `delimiter_prefer_spaced` (prefer ` =` over bare `=` as delimiter), `toplevel_indent_strip` (use baseline 0 so all indented lines are continuations), and `tabs_as_whitespace` (strip leading tab whitespace on continuation lines and convert embedded tabs to spaces in values). The test runner now derives and passes `ParseOptions` to parse functions based on test case behaviors, unlocking 41 previously-skipped behavior tests.
