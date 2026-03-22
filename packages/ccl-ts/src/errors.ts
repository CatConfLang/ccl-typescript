/**
 * Error classes for the throwing CCL API.
 *
 * These extend the standard `Error` class and provide structured error
 * information (line/column for parse errors, path for access errors).
 *
 * @packageDocumentation
 */

import type { AccessError, ParseError } from "./types.js";

/**
 * Error thrown when CCL text cannot be parsed.
 *
 * @beta
 */
export class CCLParseError extends Error {
	/** Line number where the error occurred (1-indexed). */
	readonly line: number | undefined;

	/** Column number where the error occurred (1-indexed). */
	readonly column: number | undefined;

	constructor(error: ParseError) {
		super(error.message);
		this.name = "CCLParseError";
		this.line = error.line;
		this.column = error.column;
	}
}

/**
 * Error thrown when accessing a value in a CCL object fails.
 *
 * @beta
 */
export class CCLAccessError extends Error {
	/** Path to the value that caused the error. */
	readonly path: string[];

	constructor(error: AccessError) {
		super(error.message);
		this.name = "CCLAccessError";
		this.path = error.path;
	}
}
