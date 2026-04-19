---
name: changeset
description: Create changeset files for the ccl-typescript monorepo using @changesets/cli. Use this skill whenever the user mentions changesets, asks to "add a changeset", wants to document a version bump, says "this needs a changeset", asks about semver impact of changes, or after completing user-facing work on any package. Also trigger when the user asks "is this a breaking change?", "should this be a patch or minor?", or "what version bump does this need?". Even if the user just says "changeset" or "cs", use this skill.
---

# Changeset Creator for ccl-typescript

Create changeset files that document version-bump-worthy changes across this monorepo's packages.

## When a changeset is needed

A changeset is needed when a change affects the **public API or user-facing behavior** of a published package. This includes:
- New exports, functions, types, or options
- Bug fixes that change observable behavior
- Breaking changes to existing APIs
- Dependency changes that affect consumers

A changeset is **not** needed for:
- Internal refactors with no API change
- Test-only changes
- CI/CD or build config changes
- Documentation-only changes (unless the docs package is independently versioned)
- Changes to private/internal packages like `@tylerbu/ccl-test-data` or `@tylerbu/ccl-test-viewer`

## Package names

Changesets reference packages by their **npm name** (from package.json `name` field), not the directory name:

| Directory | npm name |
|-----------|----------|
| `packages/ccl-ts` | `ccl-ts` |
| `packages/ccl-test-runner-ts` | `ccl-test-runner-ts` |
| `packages/ccl-zod` | `ccl-zod` |
| `packages/ccl-test-data` | `@tylerbu/ccl-test-data` |
| `packages/ccl-test-viewer` | `@tylerbu/ccl-test-viewer` |

## Choosing the version bump

- **patch**: Bug fixes, performance improvements, internal behavior changes that don't affect the API surface
- **minor**: New features, new exports, new options on existing functions — anything additive and non-breaking
- **major**: Removed exports, renamed functions, changed return types, changed required parameters — anything that would break existing consumers

When in doubt between patch and minor, prefer minor if there's any new public API surface. When in doubt between minor and major, check whether existing code that imports from the package would still compile and behave the same — if yes, it's minor.

## Creating the changeset file

1. **Determine what changed** — look at the current branch's diff against main (`git diff main...HEAD` or staged changes) to understand the scope
2. **Pick a descriptive filename** — use a short kebab-case name that describes the change (e.g., `add-config-yaml-support.md`, `fix-parse-empty-input.md`). Avoid the random word filenames that `changeset add` generates.
3. **Write the file** in `.changeset/<filename>.md`:

```markdown
---
"<package-name>": <patch|minor|major>
---

<Description of the change — 1-3 sentences focused on what's new or different from a consumer's perspective.>
```

The YAML frontmatter lists each affected package and its bump level. Multiple packages can be listed if a single change affects several:

```markdown
---
"ccl-ts": minor
"ccl-test-runner-ts": patch
---

Description here.
```

## Writing the description

- Write from the consumer's perspective — what do they get or what changed for them?
- Lead with what was added/fixed/changed, not how it was implemented
- For new features, mention the key new exports or options by name
- Keep it to 1-3 sentences; the PR and commit messages have the full story
- Don't start with "This changeset..." or "Changes:" — just describe the change directly

## After creating

Confirm with the user what you created: the filename, which packages are bumped, the bump level, and the description. This gives them a chance to adjust before committing.
