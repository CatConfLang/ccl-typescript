---
title: Writing CCL
description: A practical guide to authoring CCL configuration files
---

This guide teaches you how to write CCL configuration files from scratch. By the end, you'll be comfortable expressing any configuration structure in CCL.

## Your First CCL File

A CCL file is a list of key-value pairs separated by `=`:

```ccl
name = My Application
version = 1.0.0
```

That's valid CCL. Every value is a string --- there are no special types, no quoting rules, and no escaping needed.

Leading and trailing whitespace is trimmed from both keys and values, so `  name  =   My Application   ` is equivalent to `name = My Application`.

## Adding Structure with Indentation

To group related settings, give a key an empty value and indent the children:

```ccl
server =
  host = 0.0.0.0
  port = 8080

database =
  host = localhost
  port = 5432
```

You can nest as deeply as you need:

```ccl
logging =
  outputs =
    console =
      enabled = true
      format = json
    file =
      enabled = true
      path = /var/log/app.log
```

:::tip
Use consistent indentation (2 spaces is conventional). CCL cares about relative indentation depth, not the exact number of spaces.
:::

## Writing Lists

Use empty keys (`= value`) to create list items:

```ccl
allowed_origins =
  = https://example.com
  = https://api.example.com
  = https://admin.example.com
```

This produces the list `["https://example.com", "https://api.example.com", "https://admin.example.com"]`.

You can also create lists by repeating the same key at the top level:

```ccl
server = web1.example.com
server = web2.example.com
server = web3.example.com
```

:::note
The empty-key style (`= value`) is preferred inside sections. Repeated keys work best at the top level.
:::

## Adding Comments

Comments use the `/=` syntax:

```ccl
/= Database configuration
/= Last updated: 2025-02-25

database =
  host = localhost
  port = 5432
  /= Credentials are loaded from environment variables
  username = ${DB_USER}
  password = ${DB_PASS}
```

Comments must be on their own line. There are no inline comments --- everything after the first `=` on a line is the value:

```ccl
port = 8080  /= This is NOT a comment
```

In this example, the value of `port` is the string `"8080  /= This is NOT a comment"`.

:::note
Comments are not stripped by the parser. They are stored as entries with `/` as the key. Your application can filter them out or interpret them however it chooses. See the [FAQ](/ccl-faq#are-comments-part-of-the-data) for details.
:::

## Writing Multiline Values

Indent continuation lines beneath the key to create multiline values:

```ccl
description = This application handles
  user authentication and
  session management for
  the main web portal.
```

The value preserves the newlines and indentation of the continuation lines.

## Special Characters

### Equals Signs in Values

Only the **first** `=` on a line separates key from value. Additional `=` characters are part of the value:

```ccl
url = https://example.com?key=value&token=abc123
equation = E = mc^2
env_override = NODE_ENV=production
```

### Dots in Keys

Dots are literal characters in keys, not path separators:

```ccl
server.host = localhost
app.config.version = 2
```

These create keys literally named `"server.host"` and `"app.config.version"`. For hierarchical structure, use indentation instead:

```ccl
server =
  host = localhost

app =
  config =
    version = 2
```

### Unicode

CCL fully supports Unicode in both keys and values:

```ccl
greeting = Hello, 世界! 🌍
author = François Müller
description = Ñoño configuration
```

## Patterns and Recipes

### Environment-Specific Configuration

```ccl
/= Shared settings
app =
  name = MyApp
  log_level = info

/= Development overrides
development =
  database =
    host = localhost
    port = 5432
  debug = true

/= Production settings
production =
  database =
    host = db.prod.internal
    port = 5432
  debug = false
```

### Feature Flags

```ccl
features =
  dark_mode = true
  beta_dashboard = false
  experimental_api = false
  /= Enabled for gradual rollout
  new_onboarding = true
```

### Service Dependencies

```ccl
services =
  auth =
    url = https://auth.internal
    timeout = 5000
    retries = 3
  payment =
    url = https://pay.internal
    timeout = 10000
    retries = 5
  notification =
    url = https://notify.internal
    timeout = 3000
    retries = 2
```

### Mixed Lists and Nested Config

```ccl
deployment =
  targets =
    = us-east-1
    = eu-west-1
    = ap-southeast-1
  strategy = rolling
  max_unavailable = 1
```

## Common Mistakes

### Accidental Multiline Values

If a line is indented more than the previous entry, it becomes a continuation of that value, not a new entry:

```ccl
/= These are TWO separate entries:
host = localhost
port = 8080

/= But this is ONE entry with a multiline value:
host = localhost
  port = 8080
```

In the second example, `host` has the value `"localhost\n  port = 8080"`.

### Forgetting the Equals Sign

Every entry needs an `=`. A line without `=` is a parse error in the reference implementation --- the parser consumes the text looking for `=` and fails when it reaches end of input or the next valid entry:

```ccl
/= This is a parse error in strict implementations:
just some text

/= Always include = even for empty values:
section =
  key = value
```

:::note
Some lenient implementations may silently discard a line with no `=` rather than error. Either way, the line will not produce an entry — so the practical rule is the same: **every line must include `=`**.

Note also that a key can span lines if the `=` appears on the next line: `key\n= value` is valid and produces `key = value`.
:::

### Inline Comments

There are no inline comments in CCL. Everything after the first `=` is the value:

```ccl
/= Do this:
/= Set the port
port = 8080

/= Not this (the "comment" becomes part of the value):
port = 8080 /= the main port
```

## Summary

| What you want | How to write it |
|---------------|-----------------|
| Simple value | `key = value` |
| Nested group | `parent =` with indented children |
| List | `= item` (empty key) inside a section |
| Comment | `/= text` on its own line |
| Multiline value | Indent continuation lines |
| Empty value | `key =` (followed by nothing or a newline) |

That's all the syntax there is. CCL's power comes from composing these few building blocks.
