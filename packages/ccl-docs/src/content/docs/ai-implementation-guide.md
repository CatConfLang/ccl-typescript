---
title: AI Implementation Guide
description: Complete guide for AI agents building CCL implementations in any programming language.
---

:::note[For AI Agents]
This page is designed for AI agents to read. If you're a human looking to give your AI agent a prompt, see [CCL Prompts](/ai-prompts).
:::

# Building a CCL Implementation

This guide provides everything an AI agent needs to implement CCL (Categorical Configuration Language) in any programming language.

## Quick Start

**CCL** is a minimal configuration language based on key-value pairs with recursive structure. The core insight: if a value contains `=` characters, it can be parsed as nested CCL. This recursive fixed-point parsing is what creates hierarchy from flat text.

**Required functions:**
- `parse` - Convert text to flat key-value entries
- `build_hierarchy` - Convert entries to nested structure

**Everything else is optional.** Typed access, filtering, and formatting are library conveniences.

## Resources

| Resource | URL |
|----------|-----|
| Documentation | https://ccl.tylerbutler.com |
| Test Suite | https://github.com/CatConfLang/ccl-test-data |
| TypeScript Implementation | https://github.com/CatConfLang/ccl-typescript |
| Gleam Implementation | https://github.com/tylerbutler/ccl_gleam |
| OCaml Implementation | https://github.com/chshersh/ccl |
| Rust (ccl-rs)        | https://github.com/hon-gyu/ccl-rs |
| Rust (serde_ccl)     | https://github.com/LechintanTudor/serde_ccl |
| Rust (sickle)        | https://github.com/tylerbutler/santa/tree/main/crates/sickle |
---

## Core Functions (Required)

### `parse`

Converts raw CCL text into a flat list of key-value entries.

**Signature:**
```
parse(text: string) -> List[Entry]
```

**Entry type:**
```
Entry {
  key: string    // Configuration key (empty string for list items)
  value: string  // Raw value (may contain nested CCL syntax)
}
```

**Algorithm:**

1. Find the first `=` character in the input
2. Everything before `=` is the key (trimmed of all whitespace including newlines)
3. Construct the value string (see precise rules below)
4. Repeat for remaining input

#### Value Construction

The value string is assembled as follows:

1. **First line**: Everything after `=` on the same line, with leading whitespace trimmed.
2. **Continuation lines**: Each subsequent line with indentation > N (the baseline) is appended verbatim, preserving its leading whitespace.
3. **Joining**: Lines are joined with `\n` separators.
4. **Final trim**: Trailing whitespace is trimmed from the complete result.

**Empty first line with continuations:** When the text after `=` is empty (or whitespace-only) and continuation lines follow, the trimmed first line is empty, so the value begins with `\n` followed by the first continuation line.

For example, `database =\n  host = localhost` produces value `"\n  host = localhost"` — the empty first line becomes `""`, joined with `\n` to the continuation `"  host = localhost"`.

**Single-line values** are simply the trimmed text after `=`: `key = value` → `"value"`.

**Example:**
```ccl
name = Alice
database =
  host = localhost
  port = 5432
```

Parses to:
```
[
  Entry {key: "name", value: "Alice"},
  Entry {key: "database", value: "\n  host = localhost\n  port = 5432"}
]
```

**Key rules:**
- Split on **first** `=` only: `a = b = c` → key: `a`, value: `b = c`
- Trim all whitespace from keys (including newlines): `"  key  "` → `"key"`, `"key \n"` → `"key"`
- Empty key `= value` → list item (key is empty string)
- Comment entry `/ = text` → key is `/`, value is `text`

**Value rules** (summary — see "Value construction" above for full algorithm):
- First line: trim leading whitespace after `=`: `key =   value` → value is `"value"`
- Continuation lines: preserved verbatim, including their leading whitespace
- Final line: trim trailing whitespace: `key = value  ` → value is `"value"`
- Lines joined with `\n`; internal newlines and indentation preserved

**Indentation handling:**

The baseline indentation (N) determines which lines are continuations vs new entries. How N is determined depends on the `toplevel_indent_strip` vs `toplevel_indent_preserve` behavior:

- **`toplevel_indent_strip`** (OCaml reference): Top-level parsing uses N=0; nested parsing uses first content line's indent
- **`toplevel_indent_preserve`** (simpler): Always use first content line's indent for all contexts

For each subsequent line, count its leading whitespace:
- If indentation > N → continuation line (append to value)
- If indentation ≤ N → new entry (stop parsing current value)

**Note:** With `toplevel_indent_preserve`, you only need one parsing algorithm. With `toplevel_indent_strip`, you need context detection to distinguish top-level from nested parsing. See [Continuation Lines](/continuation-lines) for details.

**Whitespace characters:** Which characters count as whitespace depends on parser behavior:
- `tabs_as_whitespace`: spaces and tabs are whitespace (used for indentation)
- `tabs_as_content`: only spaces are whitespace; tabs are preserved as content

See [Behavior Reference](/behavior-reference) for details.

See [Parsing Algorithm](/parsing-algorithm) for complete details.

---

### `build_hierarchy`

Converts flat entries into a nested object structure via recursive parsing.

**Signature:**
```
build_hierarchy(entries: List[Entry]) -> CCL
```

**Return type:**

`build_hierarchy` **always returns a map** (object/dict), even when all entries have empty keys. The observable structure of a CCL value is:

- **String** — terminal value (no `=` in content, fixed point reached)
- **Map** — nested object (from recursive parsing of a value containing `=`)
- **List** — array of values (from multiple entries sharing the same key)

Different languages encode this differently. The pseudocode uses:
```
CCL = Map[string, CCL | string | List[CCLValue]]
```

The OCaml reference uses a uniform recursive type `Fix of t Map.Make(String).t` where every value is a nested map (strings are represented as single-key maps). What matters is the observable output, not the internal type encoding.

**Algorithm:**

```pseudocode
function build_hierarchy(entries):
    result = {}
    for entry in entries:
        if entry.key == "":
            # Empty key = list item (accumulate under "" key)
            accumulate_list(result, "", entry.value)
        else if contains_ccl_syntax(entry.value):
            # Value has '=' → parse recursively
            nested_entries = parse(entry.value)
            result[entry.key] = build_hierarchy(nested_entries)
        else:
            # Terminal value (fixed point reached)
            result[entry.key] = entry.value
    return result

function contains_ccl_syntax(value):
    return "=" in value
```

**List accumulation for empty keys:** When multiple entries share the same key (including `""`), their values are collected into a list. For example, input `= alice\n= bob` produces `{"": ["alice", "bob"]}` — a map with key `""` mapping to a list. Implementations may use any internal mechanism to achieve this (explicit list tracking, tagged unions, etc.).

**Fixed-point termination:** Recursion stops when values contain no `=` characters. Plain strings like `"localhost"` or `"5432"` have no structure to parse.

**Example:**

Input entries:
```
[
  Entry {key: "database", value: "\n  host = localhost\n  port = 5432"},
  Entry {key: "users", value: "\n  = alice\n  = bob"}
]
```

After recursive parsing:
```json
{
  "database": {
    "host": "localhost",
    "port": "5432"
  },
  "users": {"": ["alice", "bob"]}
}
```

Note: `users` is a map with empty-key list, not a bare list. Library convenience functions like `get_list` may present this as `["alice", "bob"]` to callers.

**Handling special cases:**
- **Empty keys:** Multiple entries with empty key `""` accumulate into a list stored in the map under key `""`
- **Duplicate keys:** Merge values or convert to list (implementation choice)
- **Nested values:** Any value containing `=` is parsed recursively

See [Parsing Algorithm](/parsing-algorithm) for the complete algorithm with examples.

---

## Typed Access Functions (Optional)

These provide convenient, type-safe value extraction. All are optional library features.

### `get_string`

```
get_string(ccl: CCL, ...path: string[]) -> string | Error
```

Navigate to path and return string value. Error if path not found or value is not a string.

**Example:** `get_string(config, "database", "host")` navigates to `config["database"]["host"]`.

### `get_int`

```
get_int(ccl: CCL, ...path: string[]) -> int | Error
```

Navigate to path, parse value as integer. Error if not a valid integer.

### `get_bool`

```
get_bool(ccl: CCL, ...path: string[]) -> bool | Error
```

Navigate to path, parse value as boolean.

**Behavior choice:**
- `boolean_strict`: Only `"true"` and `"false"`
- `boolean_lenient`: Also accepts `"yes"/"no"`, `"1"/"0"`

### `get_float`

```
get_float(ccl: CCL, ...path: string[]) -> float | Error
```

Navigate to path, parse value as floating-point number.

### `get_list`

```
get_list(ccl: CCL, ...path: string[]) -> List[string] | Error
```

Navigate to path, return list of values.

**Behavior choice:**
- `list_coercion_enabled`: Single value returns `[value]`
- `list_coercion_disabled`: Error if not actually a list

**Path navigation:** Pass each path segment as a separate argument: `get_string(config, "database", "host")`

See [Library Features](/library-features) for implementation details.

---

## Processing Functions (Optional)

### `filter`

```
filter(entries: List[Entry], predicate: fn(Entry) -> bool) -> List[Entry]
```

Filter entries based on predicate. Common use: remove comments (entries where key starts with `/`).

### `compose`

```
compose(entries1: List[Entry], entries2: List[Entry]) -> List[Entry]
```

Concatenate entry lists. This is a monoid operation - entries form a monoid under composition with empty list as identity.

See [Library Features](/library-features) for details on entry processing.

---

## Formatting Functions (Optional)

### `print`

```
print(entries: List[Entry]) -> string
```

Convert entries back to CCL text. **Structure-preserving:** For inputs in standard format, `print(parse(x)) == x`.

### `canonical_format`

```
canonical_format(ccl: CCL) -> string
```

Convert CCL object to standardized text format. **Semantic-preserving:** Normalizes formatting but preserves meaning.

**Key difference:**
- `print` preserves original structure (comments, ordering, formatting)
- `canonical_format` produces normalized output from the parsed model

See [Library Features: Formatting](/library-features#formatting-functions) for details.

---

## Implementation Behaviors

CCL implementations make choices about edge cases. Declare your choices and the test suite will filter appropriately.

| Behavior Group | Options | Description |
|----------------|---------|-------------|
| Continuation Baseline | `toplevel_indent_strip` / `toplevel_indent_preserve` | Top-level N=0 (reference) or N=first key's indent (simpler) |
| Line Endings | `crlf_preserve_literal` / `crlf_normalize_to_lf` | Keep `\r` chars or normalize to LF |
| Boolean Parsing | `boolean_strict` / `boolean_lenient` | Only true/false or also yes/no |
| Tab Handling | `tabs_as_content` / `tabs_as_whitespace` | Preserve tabs or treat as whitespace |
| Indentation | `indent_spaces` / `indent_tabs` | Output formatting style |
| List Coercion | `list_coercion_enabled` / `list_coercion_disabled` | Single value as one-item list |
| Array Ordering | `array_order_insertion` / `array_order_lexicographic` | Preserve order or sort |

See [Behavior Reference](/behavior-reference) for detailed documentation of each behavior.

---

## Testing Your Implementation

### Test Suite

The official test suite at https://github.com/CatConfLang/ccl-test-data provides comprehensive validation:

- **Hundreds of assertions** across a growing test suite
- **JSON format** in `generated_tests/` directory
- **Capability-based filtering** by function, behavior, and variant

### Test Format

Each test specifies:
```json
{
  "name": "basic_key_value_pairs_parse",
  "validation": "parse",
  "input": "name = Alice\nage = 42",
  "expected": {
    "count": 2,
    "entries": [
      {"key": "name", "value": "Alice"},
      {"key": "age", "value": "42"}
    ]
  },
  "functions": ["parse"],
  "features": [],
  "behaviors": []
}
```

### Filtering Tests

Filter by your implementation's capabilities:

```javascript
const runnable = tests.filter(test =>
  // Only run tests for functions you've implemented
  test.functions.every(fn => implementedFunctions.includes(fn)) &&
  // Skip tests with conflicting behaviors
  !test.conflicts?.behaviors?.some(b => myBehaviors.includes(b))
);
```

### Check for Existing Test Runners

Before building a test runner, check if one exists for your language:
- **Go:** Built-in test runner in ccl-test-data repository
- **Other languages:** You may need to build a test loader

See [Test Suite Guide](/test-suite-guide) for complete filtering examples and test format documentation.

---

## Common Pitfalls

:::caution[Critical Implementation Notes]
These are the most common mistakes when implementing CCL:
:::

1. **Use snake_case everywhere**
   - Correct: `build_hierarchy`, `get_string`, `experimental_dotted_keys`
   - Wrong: `build-hierarchy`, `getString`, `dotted-keys`

2. **Split on FIRST `=` only**
   - Input: `key = value = more`
   - Key: `key`, Value: `value = more`

3. **CCL is NOT like YAML/JSON**
   - No special syntax for nesting (just indentation + `=`)
   - Recursive fixed-point parsing, not grammar-based
   - Values containing `=` are recursively parsed

4. **Only LF is a newline**
   - CR (`\r`) is preserved as content
   - CRLF handling is a behavior choice

5. **Whitespace trimming**
   - Keys: trim all whitespace (including newlines)
   - Values: trim leading (first line) and trailing (final line) only
   - Values preserve internal newlines and indentation

6. **Empty key = list item**
   - `= alice` has key `""` and value `"alice"`
   - Multiple empty-key entries form a list

See [AI Quickstart](/ai-quickstart#common-ai-assistant-pitfalls) for additional guidance.

---

## Data Types Summary

### Entry

The fundamental unit from parsing:

```
Entry {
  key: string    // Configuration key (empty string for list items)
  value: string  // Raw value (may contain nested CCL syntax)
}
```

### CCL Object

The hierarchical structure after `build_hierarchy`. The top-level return is always a map:

```
CCL = Map[string, CCLValue]
CCLValue = string | CCL | List[CCLValue]
```

Where values can be:
- **String** - Terminal value (no `=` in content)
- **CCL** - Nested object (parsed from value containing `=`)
- **List** - Array of values (from multiple entries with the same key, including empty-key `""` list items)

:::note[Type Encoding Varies]
This pseudocode type is one valid representation. The OCaml reference uses a uniform recursive type `Fix of t Map.Make(String).t` where every value is a nested map. Other implementations may use tagged unions, interfaces, or dynamic types. Choose what's idiomatic for your language — the observable structure is what matters.
:::

---

## Recommended Implementation Order

Start with core functions and add features incrementally:

1. **`parse`** - Basic key-value parsing
2. **`build_hierarchy`** - Recursive object construction
3. **`get_string`** - Simple path navigation
4. **`get_int`, `get_bool`, `get_float`** - Type conversions
5. **`get_list`** - List extraction
6. **`filter`, `compose`** - Entry processing
7. **`print`, `canonical_format`** - Output formatting

The test suite supports this progression - filter tests by `functions` array to run only relevant tests at each stage.

---

## Quick Reference

```
REQUIRED:        parse, build_hierarchy
TYPED ACCESS:    get_string, get_int, get_bool, get_float, get_list
PROCESSING:      filter, compose
FORMATTING:      print, canonical_format
TERMINOLOGY:     Always use snake_case
ALGORITHM:       Recursive fixed-point parsing
TEST SUITE:      github.com/tylerbutler/ccl-test-data
DOCUMENTATION:   ccl.tylerbutler.com
```
