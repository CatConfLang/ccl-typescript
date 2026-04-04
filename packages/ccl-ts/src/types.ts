/**
 * Core CCL type definitions.
 *
 * These types represent the data structures used throughout CCL parsing
 * and object construction.
 *
 * @packageDocumentation
 */

/**
 * A key-value entry from parsing CCL text.
 * This is the output of the `parse` function.
 *
 * @beta
 */
export interface Entry {
	/** The key portion of the entry */
	key: string;
	/** The value portion of the entry (always a string in flat parsing) */
	value: string;
}

/**
 * A single item that can appear in a CCL list.
 * Lists may contain either plain string values or nested objects (from
 * bare-list syntax with structured children).
 */
export type CCLListItem = string | CCLObject;
export type CCLList = CCLListItem[];

/**
 * Recursive CCL object type representing the output of `buildHierarchy`.
 * Values can be:
 * - string: A leaf value
 * - Array<string | CCLObject>: A list of values (from duplicate keys or bare lists)
 * - CCLObject: A nested object
 *
 * @beta
 */
export type CCLValue = string | CCLList | CCLObject;

/**
 * A CCL object is a record of string keys to CCL values.
 * This is the output of the `buildHierarchy` function.
 *
 * @beta
 */
export interface CCLObject {
	[key: string]: CCLValue;
}

/**
 * Parse error that can occur when parsing CCL text.
 *
 * @beta
 */
export interface ParseError {
	/** Error message */
	message: string;
	/** Line number where the error occurred (1-indexed) */
	line?: number;
	/** Column number where the error occurred (1-indexed) */
	column?: number;
}

/**
 * Access error that can occur when accessing values in a CCL object.
 *
 * @beta
 */
export interface AccessError {
	/** Error message */
	message: string;
	/** Path to the value that caused the error */
	path: string[];
}

/**
 * How the parser treats tab characters.
 *
 * - `tabs_as_content`: Only spaces are whitespace; tabs are preserved as content.
 * - `tabs_as_whitespace`: Both spaces and tabs are treated as whitespace.
 *
 * @beta
 */
export type TabHandling = "tabs_as_content" | "tabs_as_whitespace";

/**
 * How the parser treats CRLF (`\r\n`) sequences.
 *
 * - `crlf_preserve_literal`: Preserves `\r` characters exactly as they appear in the input.
 * - `crlf_normalize_to_lf`: Converts all `\r\n` sequences to `\n` before parsing.
 *
 * @beta
 */
export type CrlfHandling = "crlf_preserve_literal" | "crlf_normalize_to_lf";

/**
 * Options for configuring CCL parsing behavior.
 *
 * @beta
 */
export interface ParseOptions {
	/**
	 * How tab characters are handled during parsing.
	 * @defaultValue `"tabs_as_content"`
	 */
	tabHandling?: TabHandling;

	/**
	 * How CRLF sequences are handled during parsing.
	 * @defaultValue `"crlf_preserve_literal"`
	 */
	crlfHandling?: CrlfHandling;
}

/**
 * Options for configuring boolean access behavior.
 *
 * @beta
 */
export interface GetBoolOptions {
	/**
	 * When true, only "true" and "false" (case-insensitive) are valid.
	 * When false (default), also accepts "yes"/"no" and "1"/"0".
	 * @defaultValue `false`
	 */
	strict?: boolean;
}

/**
 * Options for configuring list access behavior.
 *
 * @beta
 */
export interface GetListOptions {
	/**
	 * When true, single string values are coerced to a one-element list.
	 * When false (default), accessing a non-list value throws an error.
	 * @defaultValue `false`
	 */
	coercion?: boolean;
}

/**
 * Options for configuring hierarchy construction behavior.
 *
 * @beta
 */
export interface BuildHierarchyOptions extends ParseOptions {
	/**
	 * Controls the ordering of list items built from duplicate keys.
	 * - `"insertion"` (default): items appear in the order they were defined.
	 * - `"lexicographic"`: string items are sorted lexicographically; non-string items retain relative order.
	 * @defaultValue `"insertion"`
	 */
	sort?: "insertion" | "lexicographic";
}
