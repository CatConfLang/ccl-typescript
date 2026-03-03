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
