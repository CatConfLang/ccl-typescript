/**
 * CCL (Categorical Configuration Language) parser implementation.
 *
 * This module provides the core parsing functionality for CCL.
 * See https://ccl.tylerbutler.com for the CCL specification.
 *
 * Functions throw {@link CCLParseError} or {@link CCLAccessError} on failure.
 */

import { CCLAccessError, CCLParseError } from "./errors.js";
import type {
	CCLList,
	CCLObject,
	CCLValue,
	Entry,
	GetBoolOptions,
	GetListOptions,
	ParseOptions,
} from "./types.js";

// Regex patterns for whitespace trimming (top-level for performance)
const LEADING_SPACES_AND_TABS = /^[ \t]+/;
const LEADING_SPACES_ONLY = /^ +/;
const TRAILING_SPACES_AND_TABS = /[ \t]+$/;
const TRAILING_SPACES_ONLY = /[ ]+$/;

/**
 * Internal resolved options where all fields are required booleans
 * for efficient branching in hot paths.
 */
interface ResolvedParseOptions {
	tabsAreWhitespace: boolean;
}

function resolveOptions(options?: ParseOptions): ResolvedParseOptions {
	return {
		tabsAreWhitespace: (options?.tabHandling ?? "tabs_as_content") === "tabs_as_whitespace",
	};
}

/**
 * Parse CCL text into a flat list of entries.
 *
 * Each entry contains a key-value pair extracted from the CCL input.
 * The parser handles multiline values, continuation lines, and indentation-based nesting.
 *
 * @param text - The CCL text to parse
 * @returns An array of entries
 *
 * @example
 * ```ts
 * const entries = parse("name=Alice\nage=30");
 * // => [{ key: "name", value: "Alice" }, { key: "age", value: "30" }]
 * ```
 *
 * @beta
 */
export function parse(text: string, options?: ParseOptions): Entry[] {
	return parseWithStrategy(text, options, false);
}

/**
 * Determine the baseline indentation for parsing.
 *
 * Finds the first non-empty line and uses its indentation as the baseline.
 * This enables correct parsing of both top-level content and nested content
 * where all entries share a common indentation level.
 */
function determineBaseline(text: string, opts: ResolvedParseOptions): number {
	let pos = 0;
	while (pos < text.length) {
		const line = getLineAt(text, pos);
		if (line === null) {
			break;
		}
		if (!isEmptyLine(line, opts)) {
			return countLeadingWhitespace(line, opts);
		}
		pos = skipLine(text, pos);
	}
	return 0;
}

/**
 * Core parsing loop parameterized on whether to normalize continuation indentation.
 */
function parseWithStrategy(
	text: string,
	options: ParseOptions | undefined,
	stripContinuationIndent: boolean,
): Entry[] {
	const opts = resolveOptions(options);
	const baseline = determineBaseline(text, opts);
	const entries: Entry[] = [];
	let pos = 0;

	while (pos < text.length) {
		const entryResult = getNextEntry(text, pos, baseline, opts, stripContinuationIndent);
		if (!entryResult) {
			break;
		}

		const { key, value, nextPos } = entryResult;
		entries.push({ key, value });
		pos = nextPos;
	}

	return entries;
}

/**
 * Extract the next entry from the text starting at the given position.
 *
 * When `stripContinuationIndent` is true, continuation lines have
 * the first value line's indentation stripped (for parse_indented behavior).
 */
function getNextEntry(
	text: string,
	startPos: number,
	baseline: number,
	opts: ResolvedParseOptions,
	stripContinuationIndent: boolean,
): (Entry & { nextPos: number }) | null {
	const eqIndex = text.indexOf("=", startPos);
	if (eqIndex === -1) {
		return null;
	}

	const rawKey = text.slice(startPos, eqIndex);
	const key = rawKey.replace(/\s+/g, " ").trim();

	const valueStart = eqIndex + 1;
	const { valueLines, nextPos } = collectValueLines(
		text,
		valueStart,
		baseline,
		opts,
		stripContinuationIndent,
	);

	const value = buildValue(valueLines, opts);

	return { key, value, nextPos };
}

/**
 * Collect value lines for an entry, handling continuation lines.
 *
 * When `stripContinuationIndent` is true, continuation lines have
 * the first value line's leading whitespace amount stripped.
 */
function collectValueLines(
	text: string,
	startPos: number,
	baseline: number,
	opts: ResolvedParseOptions,
	stripContinuationIndent: boolean,
): { valueLines: string[]; nextPos: number } {
	const valueLines: string[] = [];
	let pos = startPos;

	// Get the first line of the value. When stripping continuation indent,
	// measure how much leading whitespace was trimmed from this line.
	let firstLineIndent = 0;
	const firstLine = getLineAt(text, pos);
	if (firstLine !== null) {
		if (stripContinuationIndent) {
			firstLineIndent = countLeadingWhitespace(firstLine, opts);
		}
		valueLines.push(trimLeadingWhitespace(firstLine, opts));
		pos = skipLine(text, pos);
	}

	while (pos < text.length) {
		const line = getLineAt(text, pos);
		if (line === null) {
			break;
		}

		if (isEmptyLine(line, opts)) {
			if (hasMoreContinuations(text, pos, baseline, opts)) {
				valueLines.push("");
				pos = skipLine(text, pos);
				continue;
			}
			break;
		}

		const indent = countLeadingWhitespace(line, opts);
		if (indent > baseline) {
			valueLines.push(
				stripContinuationIndent ? stripLeadingWhitespace(line, firstLineIndent, opts) : line,
			);
			pos = skipLine(text, pos);
		} else {
			break;
		}
	}

	return { valueLines, nextPos: pos };
}

/**
 * Trim leading whitespace from a string.
 * Under tabs_as_content, only spaces are stripped; tabs are preserved.
 */
function trimLeadingWhitespace(s: string, opts: ResolvedParseOptions): string {
	return s.replace(opts.tabsAreWhitespace ? LEADING_SPACES_AND_TABS : LEADING_SPACES_ONLY, "");
}

/**
 * Strip a specific number of leading whitespace characters from a string.
 * Under tabs_as_content, only spaces count toward the strip count.
 */
function stripLeadingWhitespace(s: string, count: number, opts: ResolvedParseOptions): string {
	let stripped = 0;
	let i = 0;
	while (i < s.length && stripped < count) {
		if (s[i] === " " || (opts.tabsAreWhitespace && s[i] === "\t")) {
			stripped++;
			i++;
		} else {
			break;
		}
	}
	return s.slice(i);
}

/**
 * Trim trailing whitespace from a string.
 * Under tabs_as_content, only spaces are stripped; tabs are preserved.
 */
function trimTrailingWhitespace(s: string, opts: ResolvedParseOptions): string {
	return s.replace(opts.tabsAreWhitespace ? TRAILING_SPACES_AND_TABS : TRAILING_SPACES_ONLY, "");
}

/**
 * Build the final value string from collected lines.
 */
function buildValue(valueLines: string[], opts: ResolvedParseOptions): string {
	if (valueLines.length === 0) {
		return "";
	}

	if (valueLines.length === 1) {
		return trimTrailingWhitespace(valueLines[0] as string, opts);
	}

	// Multiline value - trim trailing spaces/tabs from last line only
	const lastIndex = valueLines.length - 1;
	const processed = valueLines.map((line, idx) =>
		idx === lastIndex ? trimTrailingWhitespace(line, opts) : line,
	);
	return processed.join("\n");
}

/**
 * Check if a line is empty (contains only whitespace or nothing).
 * Under tabs_as_content, a line with only tabs is NOT empty.
 */
function isEmptyLine(line: string, opts: ResolvedParseOptions): boolean {
	if (opts.tabsAreWhitespace) {
		return line.trim() === "";
	}
	// tabs_as_content: only spaces and CR are whitespace; tabs are content
	for (const char of line) {
		if (char !== " " && char !== "\r") {
			return false;
		}
	}
	return true;
}

/**
 * Check if there are more continuation lines after the current position.
 */
function hasMoreContinuations(
	text: string,
	pos: number,
	baseline: number,
	opts: ResolvedParseOptions,
): boolean {
	let checkPos = pos;

	while (checkPos < text.length) {
		const line = getLineAt(text, checkPos);
		if (line === null) {
			break;
		}

		if (!isEmptyLine(line, opts)) {
			const indent = countLeadingWhitespace(line, opts);
			return indent > baseline;
		}

		checkPos = skipLine(text, checkPos);
	}

	return false;
}

/**
 * Get the line at the given position, or null if at end.
 */
function getLineAt(text: string, pos: number): string | null {
	if (pos >= text.length) {
		return null;
	}

	const end = text.indexOf("\n", pos);
	return end === -1 ? text.slice(pos) : text.slice(pos, end);
}

/**
 * Skip past the current line and return the position of the next line.
 */
function skipLine(text: string, pos: number): number {
	const end = text.indexOf("\n", pos);
	return end === -1 ? text.length : end + 1;
}

/**
 * Count leading whitespace characters.
 * Under tabs_as_content, only spaces count as whitespace.
 */
function countLeadingWhitespace(line: string, opts: ResolvedParseOptions): number {
	let count = 0;
	for (const char of line) {
		if (char === " " || (opts.tabsAreWhitespace && char === "\t")) {
			count++;
		} else {
			break;
		}
	}
	return count;
}

/**
 * Build a hierarchical object from flat entries.
 *
 * Takes a flat list of entries (from `parse`) and recursively
 * parses any nested CCL syntax in the values to build a hierarchical object.
 *
 * Algorithm:
 * 1. Initialize an empty result map
 * 2. Iterate through each entry in the input list
 * 3. Classify each entry:
 *    - Empty key ("") → add to list collection
 *    - Value contains "=" → recursively parse as nested CCL
 *    - Otherwise → store as terminal string value
 * 4. Return the constructed hierarchy
 *
 * @param entries - The flat entries from a parse operation
 * @returns A hierarchical CCL object
 *
 * @example
 * ```ts
 * const entries = parse("server=\n  host=localhost\n  port=8080");
 * const obj = buildHierarchy(entries);
 * // => { server: { host: "localhost", port: "8080" } }
 * ```
 *
 * @beta
 */
export function buildHierarchy(entries: Entry[], options?: ParseOptions): CCLObject {
	const result: CCLObject = {};

	for (const entry of entries) {
		const { key, value } = entry;

		if (key === "") {
			if (containsCCLSyntax(value)) {
				const listItem = parseNestedObjectValue(value, options);
				addToList(result, "", listItem);
			} else {
				addToList(result, "", value);
			}
		} else if (containsCCLSyntax(value)) {
			// Value contains "=" → recursively parse as nested CCL
			const nestedEntries = parse(value, options);
			const nestedObj = buildHierarchy(nestedEntries, options);

			// Check if key already exists
			const existing = result[key];
			if (existing === undefined) {
				// First occurrence
				result[key] = nestedObj;
			} else if (isPlainObject(existing)) {
				// Merge with existing object
				result[key] = mergeObjects(existing, nestedObj);
			}
			// If existing is a string or array, nested object takes precedence
			// (this is an edge case that shouldn't happen with valid CCL)
		} else {
			// Terminal string value - handle duplicates by converting to list
			const existing = result[key];
			if (existing === undefined) {
				// First occurrence - store as string
				result[key] = value;
			} else if (Array.isArray(existing)) {
				// Already an array - append
				existing.push(value);
			} else if (typeof existing === "string") {
				// Second occurrence - convert to array
				result[key] = [existing, value];
			}
			// If it's a nested object, we ignore duplicate string
		}
	}

	return result;
}

/**
 * Check if a value is a plain object (not array, not null).
 */
function isPlainObject(value: unknown): value is CCLObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merge two CCL objects, combining their properties.
 * When both have the same key:
 * - If both are objects, merge recursively
 * - If both are strings, convert to array
 * - If both are arrays, concatenate
 * - Otherwise, the second value takes precedence
 */
function mergeObjects(base: CCLObject, overlay: CCLObject): CCLObject {
	const result: CCLObject = { ...base };

	for (const [key, value] of Object.entries(overlay)) {
		const existing = result[key];

		if (existing === undefined) {
			result[key] = value;
		} else if (isPlainObject(existing) && isPlainObject(value)) {
			// Both are objects - merge recursively
			result[key] = mergeObjects(existing, value);
		} else if (Array.isArray(existing) && Array.isArray(value)) {
			// Both are arrays - concatenate
			result[key] = [...existing, ...value];
		} else if (typeof existing === "string" && typeof value === "string") {
			// Both are strings - convert to array
			result[key] = [existing, value];
		} else if (Array.isArray(existing) && typeof value === "string") {
			// Existing is array, new is string - append
			result[key] = [...existing, value];
		} else if (Array.isArray(existing) && isPlainObject(value)) {
			// Existing list with new object entry
			result[key] = [...existing, value];
		} else if (typeof existing === "string" && Array.isArray(value)) {
			// Existing is string, new is array - prepend existing to array
			result[key] = [existing, ...value];
		} else if (isPlainObject(existing) && Array.isArray(value)) {
			result[key] = [existing, ...value];
		} else if (typeof existing === "string" && isPlainObject(value)) {
			result[key] = [existing, value];
		} else if (isPlainObject(existing) && typeof value === "string") {
			result[key] = [existing, value];
		} else {
			// Different types or edge cases - overlay takes precedence
			result[key] = value;
		}
	}

	return result;
}

/**
 * Check if a value contains CCL syntax (indicating nested structure that should be parsed).
 *
 * A value contains CCL syntax if:
 * - It contains an `=` character, AND
 * - There is a newline before the `=` (meaning it's a multi-line value with nested entries)
 *
 * Single-line values like "foo=bar" or "<>=+" are treated as literal strings,
 * not as nested CCL structures.
 */
function containsCCLSyntax(value: string): boolean {
	const eqIndex = value.indexOf("=");
	if (eqIndex === -1) {
		return false;
	}

	// Check if there's a newline before the equals sign
	// This distinguishes multi-line nested values from single-line literal strings
	const beforeEquals = value.slice(0, eqIndex);
	return beforeEquals.includes("\n");
}

function parseNestedObjectValue(value: string, options?: ParseOptions): CCLObject {
	const nestedEntries = parse(value, options);
	return buildHierarchy(nestedEntries, options);
}

/**
 * Add a value to a list at the given key in the result object.
 * If the key doesn't exist, creates an array with the value.
 * If the key exists and is already an array, appends to it.
 * If the key exists and is a primitive/object, converts to array preserving both values.
 */
function addToList(result: CCLObject, key: string, value: string | CCLObject): void {
	const existing = result[key];

	if (existing === undefined) {
		// First value - create array
		result[key] = [value];
	} else if (Array.isArray(existing)) {
		// Already an array - append
		existing.push(value);
	} else if (typeof existing === "string") {
		// Was a single string - convert to array
		result[key] = [existing, value];
	} else if (isPlainObject(existing)) {
		// Was a single object - convert to array with both entries
		result[key] = [existing, value];
	}
}

// ============================================================================
// Typed Access Functions
// ============================================================================
// These functions provide type-safe access to CCL values.
// Leaf values are strings, while lists can contain strings or nested objects.
// Path navigation uses variadic arguments: getString(obj, "server", "host")

/**
 * Navigate to a value at the specified path in a CCL object.
 *
 * @param obj - The CCL object to navigate
 * @param pathParts - Path components to the value (e.g., "server", "host")
 * @returns The value at the path, or undefined if not found
 */
function navigateToValue(obj: CCLObject, pathParts: string[]): CCLValue | undefined {
	if (pathParts.length === 0) {
		// Empty path - return the root object itself is not valid for typed access
		return undefined;
	}

	let current: CCLValue = obj;

	for (const part of pathParts) {
		if (!isPlainObject(current)) {
			// Can't navigate further into a non-object
			return undefined;
		}
		const next: CCLValue | undefined = current[part];
		if (next === undefined) {
			return undefined;
		}
		current = next;
	}

	return current;
}

/**
 * Get a string value at the specified path.
 *
 * Navigates to the path and returns the value if it's a string.
 * Returns an error Result if the path doesn't exist or the value isn't a string.
 *
 * @param obj - The CCL object to query
 * @param pathParts - Path components to the value (e.g., "server", "host")
 * @returns The string value
 *
 * @throws {@link CCLAccessError} if the path does not exist or the value is not a string.
 *
 * @example
 * ```ts
 * const obj = buildHierarchy(parse("server=\n  host=localhost"));
 * const host = getString(obj, "server", "host"); // => "localhost"
 * ```
 *
 * @beta
 */
export function getString(obj: CCLObject, ...pathParts: string[]): string {
	const value = navigateToValue(obj, pathParts);

	if (value === undefined) {
		throw new CCLAccessError({ message: "Path not found", path: pathParts });
	}

	if (typeof value !== "string") {
		throw new CCLAccessError({
			message: `Value is not a string (got ${Array.isArray(value) ? "array" : "object"})`,
			path: pathParts,
		});
	}

	return value;
}

/**
 * Get a trimmed non-empty string for numeric parsing.
 * Returns the original value alongside trimmed for error messages.
 */
function getTrimmedForParsing(
	obj: CCLObject,
	pathParts: string[],
	typeName: string,
): { original: string; trimmed: string } {
	const original = getString(obj, ...pathParts);
	const trimmed = original.trim();

	if (trimmed === "") {
		throw new CCLAccessError({
			message: `Value is empty, cannot parse as ${typeName}`,
			path: pathParts,
		});
	}

	return { original, trimmed };
}

/**
 * Get an integer value at the specified path.
 *
 * Navigates to the path, retrieves the string value, and parses it as an integer.
 * Returns an error Result if the path doesn't exist, value isn't a string, or parsing fails.
 *
 * @param obj - The CCL object to query
 * @param pathParts - Path components to the value
 * @returns The integer value
 *
 * @throws {@link CCLAccessError} if the path does not exist or the value cannot be parsed as an integer.
 *
 * @example
 * ```ts
 * const obj = buildHierarchy(parse("port=8080"));
 * const port = getInt(obj, "port"); // => 8080
 * ```
 *
 * @beta
 */
export function getInt(obj: CCLObject, ...pathParts: string[]): number {
	const { original, trimmed } = getTrimmedForParsing(obj, pathParts, "integer");

	const parsed = Number(trimmed);

	if (!Number.isFinite(parsed)) {
		throw new CCLAccessError({
			message: `Value is not a valid integer: '${original}'`,
			path: pathParts,
		});
	}

	if (!Number.isInteger(parsed)) {
		throw new CCLAccessError({
			message: `Value is not an integer (has decimal): '${original}'`,
			path: pathParts,
		});
	}

	return parsed;
}

/**
 * Get a boolean value at the specified path.
 *
 * Navigates to the path, retrieves the string value, and parses it as a boolean.
 * By default (lenient mode), accepts true/false, yes/no, 1/0 (case-insensitive).
 * In strict mode, only true/false (case-insensitive) are accepted.
 *
 * @param obj - The CCL object to query
 * @param pathParts - Path components to the value
 * @param options - Options controlling boolean parsing behavior
 * @returns The boolean value
 *
 * @throws {@link CCLAccessError} if the path does not exist or the value is not a valid boolean.
 *
 * @example
 * ```ts
 * const obj = buildHierarchy(parse("enabled=true\ndebug=yes"));
 * const enabled = getBool(obj, ["enabled"]); // => true
 * const debug = getBool(obj, ["debug"]); // => true (lenient)
 * const strict = getBool(obj, ["debug"], { strict: true }); // throws
 * ```
 *
 * @beta
 */
export function getBool(obj: CCLObject, pathParts: string[], options?: GetBoolOptions): boolean {
	const strValue = getString(obj, ...pathParts);

	// Normalize to lowercase and trim for comparison
	const normalized = strValue.trim().toLowerCase();

	if (options?.strict) {
		// Strict mode: only accept true/false
		switch (normalized) {
			case "true":
				return true;
			case "false":
				return false;
			default:
				throw new CCLAccessError({
					message: `Value is not a valid boolean: '${strValue}'`,
					path: pathParts,
				});
		}
	}

	// Lenient mode: accept true/false, yes/no, 1/0
	switch (normalized) {
		case "true":
		case "yes":
		case "1":
			return true;
		case "false":
		case "no":
		case "0":
			return false;
		default:
			throw new CCLAccessError({
				message: `Value is not a valid boolean: '${strValue}'`,
				path: pathParts,
			});
	}
}

/**
 * Get a float value at the specified path.
 *
 * Navigates to the path, retrieves the string value, and parses it as a float.
 * Returns an error Result if the path doesn't exist, value isn't a string, or parsing fails.
 *
 * @param obj - The CCL object to query
 * @param pathParts - Path components to the value
 * @returns The float value
 *
 * @throws {@link CCLAccessError} if the path does not exist or the value cannot be parsed as a float.
 *
 * @example
 * ```ts
 * const obj = buildHierarchy(parse("ratio=3.14"));
 * const ratio = getFloat(obj, "ratio"); // => 3.14
 * ```
 *
 * @beta
 */
export function getFloat(obj: CCLObject, ...pathParts: string[]): number {
	const { original, trimmed } = getTrimmedForParsing(obj, pathParts, "float");

	const parsed = Number(trimmed);

	if (!Number.isFinite(parsed)) {
		throw new CCLAccessError({
			message: `Value is not a valid number: '${original}'`,
			path: pathParts,
		});
	}

	return parsed;
}

/**
 * Get a list value at the specified path.
 *
 * Navigates to the path and returns the value if it's an array.
 * If the path points to an object with an empty-key list (bare list syntax),
 * automatically returns that list.
 * By default, does NOT coerce single values to lists. With `{ coercion: true }`,
 * single string values are wrapped in a one-element array.
 *
 * @param obj - The CCL object to query
 * @param pathParts - Path components to the value
 * @param options - Options controlling list coercion behavior
 * @returns The array of list items (strings or nested objects)
 *
 * @throws {@link CCLAccessError} if the path does not exist or the value is not a list.
 *
 * @example
 * ```ts
 * // Duplicate keys create a list directly
 * const obj1 = buildHierarchy(parse("colors=red\ncolors=green\ncolors=blue"));
 * const colors = getList(obj1, ["colors"]); // => ["red", "green", "blue"]
 *
 * // Single value coercion
 * const obj2 = buildHierarchy(parse("tag=hello"));
 * const tags = getList(obj2, ["tag"], { coercion: true }); // => ["hello"]
 * ```
 *
 * @beta
 */
export function getList(obj: CCLObject, pathParts: string[], options?: GetListOptions): CCLList {
	const value = navigateToValue(obj, pathParts);

	if (value === undefined) {
		throw new CCLAccessError({ message: "Path not found", path: pathParts });
	}

	// Direct array (from duplicate keys)
	if (Array.isArray(value)) {
		return value;
	}

	// Object with empty-key list (bare list syntax)
	if (isPlainObject(value)) {
		const emptyKeyValue = value[""];
		if (Array.isArray(emptyKeyValue)) {
			return emptyKeyValue;
		}
	}

	// Coercion: wrap single string values as a one-element list
	if (options?.coercion && typeof value === "string") {
		return [value];
	}

	throw new CCLAccessError({
		message: `Value is not a list (got ${typeof value === "string" ? "string" : "object"})`,
		path: pathParts,
	});
}

// ============================================================================
// Formatting Functions
// ============================================================================
// These functions convert CCL structures back to text representation.

/**
 * Print entries to CCL format.
 *
 * Converts a flat list of entries back to CCL text format.
 * This function provides structure-preserving round-trip capability:
 * for standard-format inputs, `print(parse(x)) == x`.
 *
 * Output format:
 * - Keys and values separated by " = "
 * - Empty keys formatted as " = value" (space before = for clarity)
 * - Multiline values preserve their content as continuation lines
 * - No trailing newline is added
 *
 * @param entries - The entries to format
 * @returns CCL-formatted string
 *
 * @example
 * ```ts
 * const entries = [
 *   { key: "name", value: "Alice" },
 *   { key: "config", value: "\n  host = localhost\n  port = 8080" }
 * ];
 * print(entries);
 * // => "name = Alice\nconfig = \n  host = localhost\n  port = 8080"
 * ```
 *
 * @beta
 */
export function print(entries: Entry[]): string {
	return entries
		.map(({ key, value }) => {
			// Empty keys get a leading space for clarity
			const keyPart = key === "" ? " " : key;
			// Multiline values: key followed by " =" (value includes newline)
			// Single-line values: key followed by " = value"
			const separator = value.includes("\n") ? " =" : " = ";
			return `${keyPart}${separator}${value}`;
		})
		.join("\n");
}

/**
 * Format input to canonical CCL representation.
 *
 * Parses the input and produces a normalized output with:
 * - Keys sorted alphabetically
 * - Consistent spacing: " = " between key and value
 * - 2-space indentation for nested content
 * - Trailing newline
 * - All values converted to nested structure form
 *
 * This transformation is semantic-preserving but changes structural representation.
 * It enables deterministic output regardless of input ordering.
 *
 * @param input - The CCL text to canonicalize
 * @returns The canonicalized CCL string
 *
 * @throws {@link CCLParseError} if the input cannot be parsed.
 *
 * @example
 * ```ts
 * const result = canonicalFormat("z = last\na = first\nm = middle");
 * // => "a =\n  first =\nm =\n  middle =\nz =\n  last =\n"
 * ```
 *
 * @beta
 */
export function canonicalFormat(input: string, options?: ParseOptions): string {
	const entries = parse(input, options);
	const obj = buildHierarchy(entries, options);
	return formatCanonical(obj, 0);
}

/**
 * Recursively format a CCL object in canonical form.
 */
function formatCanonical(obj: CCLObject, depth: number): string {
	const indent = "  ".repeat(depth);
	const childIndent = `${indent}  `;

	const lines = Object.keys(obj)
		.sort()
		.flatMap((key) => {
			const value = obj[key] as CCLValue;
			const keyLine = `${indent}${key} =`;

			if (typeof value === "string") {
				// Empty string: just the key line; non-empty: key line + value line
				return value === "" ? [keyLine] : [keyLine, `${childIndent}${value} =`];
			}
			if (Array.isArray(value)) {
				// List: key line + each item as a child line
				return [keyLine, ...value.map((item) => `${childIndent}${item} =`)];
			}
			// Nested object: key line + recursive content (trim trailing newline)
			return [keyLine, formatCanonical(value, depth + 1).slice(0, -1)];
		});

	return `${lines.join("\n")}\n`;
}

// ============================================================================
// Future Functions (commented out stubs)
// ============================================================================
// Uncomment and implement these functions as needed.
// Each function should be added to the test config in test/ccl.test.ts
// and exported from src/index.ts when implemented.

/**
 * Parse CCL text with indentation normalization.
 *
 * Similar to `parse`, but normalizes continuation line indentation:
 * the leading whitespace from the first value line (after `=`) is stripped
 * from all continuation lines, preserving relative indentation.
 *
 * @param text - The CCL text to parse
 * @param options - Optional parsing configuration
 * @returns An array of entries with key-value pairs
 *
 * @beta
 */
export function parseIndented(text: string, options?: ParseOptions): Entry[] {
	return parseWithStrategy(text, options, true);
}

/**
 * Filter entries based on a predicate.
 *
 * @param entries - The entries to filter
 * @param predicate - A function that returns true for entries to keep
 * @returns Filtered entries
 *
 * @beta
 */
export function filter(
	entries: Entry[],
	predicate: (entry: Entry) => boolean,
): Entry[] {
	return entries.filter(predicate);
}

/**
 * Compose two entry lists.
 *
 * Composition is an entry-level operation: it appends the overlay entries
 * after the base entries so downstream processing (for example
 * `buildHierarchy(compose(base, overlay))`) observes the combined document.
 *
 * This gives `Entry[]` the expected monoid identity of `[]` and keeps
 * composition structure-preserving at the entry layer.
 *
 * @param base - The base entries
 * @param overlay - The overlay entries to append
 * @returns The combined entry list
 *
 * @beta
 */
export function compose(base: Entry[], overlay: Entry[]): Entry[] {
	return [...base, ...overlay];
}

// /**
//  * Load and parse CCL from string directly to object.
//  *
//  * Convenience function combining parse and buildHierarchy.
//  *
//  * @param input - The CCL text to load
//  * @returns A hierarchical CCL object
//  */
// export function load(input: string): CCLObject {
// 	throw new Error("Not yet implemented");
// }

// /**
//  * Round-trip: parse, build, print.
//  *
//  * @param input - The CCL text to round-trip
//  * @returns The round-tripped CCL string
//  */
// export function roundTrip(input: string): string {
// 	throw new Error("Not yet implemented");
// }
