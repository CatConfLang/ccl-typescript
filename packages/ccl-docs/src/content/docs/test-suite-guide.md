---
title: Test Suite Guide
description: Using the CCL test suite for progressive implementation validation.
---

The [CCL Test Suite](https://github.com/tylerbutler/ccl-test-data) provides hundreds of assertions across hundreds of tests for validating CCL implementations.

## Test Format

Implementers use the **flat format** in `generated_tests/` - one test per validation function with typed fields for filtering.

### Test Structure

Each test includes:
- `validation`: Function being tested (`parse`, `build_hierarchy`, etc.)
- `functions`: Array of required CCL functions — **used for filtering**
- `behaviors`: Array of implementation behavior choices — **used for filtering** (via `conflicts`)
- `variants`: Array of specification variants — **used for filtering** (via `conflicts`)
- `features`: Array of language features exercised — **informational only** (for coverage reporting, not filtering)
- `expected`: Expected result with `count` field for assertion verification
- `inputs`: Array of CCL text strings to parse (typically a 1-element array; composition tests may have 2–3)

### Test Metadata

**Functions** - CCL functions by category:
- **Core Parsing**: `parse`, `build_hierarchy`
  - `parse_indented` is also required but is typically **internal** — called by `build_hierarchy`, not part of the public API
- **Convenience**: `load` (combines `parse` + `build_hierarchy`)
- **Typed Access**: `get_string`, `get_int`, `get_bool`, `get_float`, `get_list`
- **Processing**: `filter`, `compose`
- **Formatting**: `print`, `canonical_format`, `round_trip`
- **Algebraic Properties**: `compose_associative`, `identity_left`, `identity_right`

**Features** - Language features exercised (informational/reporting only, not used for filtering):
- `comments`, `empty_keys`, `multiline`, `unicode`, `whitespace`
- `optional_typed_accessors` — typed access functions (`get_string`, `get_int`, etc.) are optional
- `experimental_dotted_keys` — dotted key expansion (experimental)

**Behaviors** - Implementation choices (exclusivity defined per-test via `conflicts` field):

| Behavior Group | Options | Description |
|----------------|---------|-------------|
| Continuation Baseline | `toplevel_indent_strip` vs `toplevel_indent_preserve` | Top-level N=0 (reference) vs N=first key's indent (simpler) |
| Line Endings | `crlf_preserve_literal` vs `crlf_normalize_to_lf` | CRLF handling: preserve `\r` chars vs normalize to LF |
| Boolean Parsing | `boolean_lenient` vs `boolean_strict` | Accept "yes"/"no" vs only "true"/"false" |
| Tab Handling | `tabs_as_content` vs `tabs_as_whitespace` | Preserve tabs literally vs treat as whitespace |
| Indentation | `indent_spaces` vs `indent_tabs` | Output formatting style |
| List Access | `list_coercion_enabled` vs `list_coercion_disabled` | List access coercion behavior |
| Array Ordering | `array_order_insertion` vs `array_order_lexicographic` | Preserve insertion order vs sort lexicographically |
| Delimiter | `delimiter_first_equals` vs `delimiter_prefer_spaced` | Split on first `=` vs prefer ` = ` (space-equals-space) |

See the [Behavior Reference](/behavior-reference/) for detailed documentation of each behavior.

## Filtering Tests by Function

### Core Parsing

**`parse`** — Filter tests:
```javascript
tests.filter(t => t.validation === 'parse')
```

**`parse_indented`** — Strips common leading whitespace before parsing (like `textwrap.dedent`). Required but typically internal — called by `build_hierarchy`, not exposed as a public API. Filter tests:
```javascript
tests.filter(t => t.validation === 'parse_indented')
```

**`build_hierarchy`** — Filter tests:
```javascript
tests.filter(t => t.validation === 'build_hierarchy')
```

**`load`** — Convenience function combining `parse` + `build_hierarchy` in one call. Filter tests:
```javascript
tests.filter(t => t.validation === 'load')
```

### Typed Access

**`get_string`, `get_int`, `get_bool`, `get_float`, `get_list`** - Filter tests:
```javascript
tests.filter(t => t.validation.startsWith('get_'))
```

### Formatting

**`print`, `round_trip`** - Filter tests:
```javascript
tests.filter(t => t.validation === 'print' || t.validation === 'round_trip')
```

The `print` function verifies structure-preserving output. For inputs in standard format (single space around `=`, 2-space indentation), `print(parse(x)) == x`.

### Algebraic Properties

**`compose_associative`, `identity_left`, `identity_right`** - These tests use multiple inputs to verify monoid properties:
```javascript
tests.filter(t => ['compose_associative', 'identity_left', 'identity_right'].includes(t.validation))
```

### Optional Features

The `features` field is **informational only** — it describes which CCL language features a test exercises but is not used to decide whether to run it. Use it to understand your coverage gaps (e.g. "I have no comment-related tests passing yet") rather than as a filter condition.

## Test Filtering

Filter tests by implementation capabilities using `functions`, `behaviors`, and `variants`:

```javascript
const supportedTests = tests.filter(test => {
  // Skip tests that require functions you haven't implemented
  if (!test.functions.every(f => implementedFunctions.includes(f))) return false;

  // Skip tests that conflict with your behavior/variant choices
  if (test.conflicts?.behaviors?.some(b => chosenBehaviors.includes(b))) return false;
  if (test.conflicts?.variants?.some(v => chosenVariants.includes(v))) return false;

  return true;
});
```

## Example Test

```json
{
  "name": "basic_key_value_pairs_parse",
  "validation": "parse",
  "inputs": ["name = Alice\nage = 42"],
  "expected": {
    "count": 2,
    "entries": [
      {"key": "name", "value": "Alice"},
      {"key": "age", "value": "42"}
    ]
  },
  "functions": ["parse"],
  "features": [],
  "behaviors": [],
  "variants": [],
  "source_test": "basic_key_value_pairs"
}
```

See [CCL Test Suite](https://github.com/tylerbutler/ccl-test-data) repository for complete test runner and JSON schema.
