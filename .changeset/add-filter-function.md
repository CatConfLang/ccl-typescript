---
"ccl-ts": minor
"ccl-test-runner-ts": minor
---

Add `filter` function to ccl-ts. Use it to filter parsed entries with a predicate, e.g. to remove comment lines:

```typescript
import { parse, filter } from "ccl-ts";

const result = parse(input);
if (result.isOk) {
  const withoutComments = filter(result.value, (entry) => entry.key !== "/");
}
```

The ccl-test-runner-ts package now supports `filter` validation, enabling test suites to exercise filter behavior against the CCL test data.
