/**
 * Error types for CCL-to-Zod extraction failures.
 *
 * @packageDocumentation
 */

import type { ZodError, ZodIssue } from "zod";

/**
 * A single field-level error from extraction.
 *
 * @beta
 */
export interface FieldError {
	/** The path to the field that failed, as an array of string keys. */
	path: string[];
	/** A human-readable error message. */
	message: string;
}

/**
 * An error returned when extraction fails, collecting all field-level errors.
 *
 * @beta
 */
export interface ExtractionError {
	/** A summary error message. */
	message: string;
	/** Individual field errors. */
	fieldErrors: FieldError[];
}

/**
 * Maps a ZodError into an ExtractionError, preserving all issue details.
 */
export function mapZodError(error: ZodError): ExtractionError {
	const fieldErrors: FieldError[] = error.issues.map(
		(issue: ZodIssue): FieldError => ({
			path: issue.path.map(String),
			message: issue.message,
		}),
	);

	const count = fieldErrors.length;
	return {
		message: `Extraction failed with ${String(count)} error${count === 1 ? "" : "s"}`,
		fieldErrors,
	};
}

/**
 * Creates an ExtractionError from coercion-phase failures.
 */
export function coercionError(path: string[], message: string): ExtractionError {
	return {
		message: `Coercion failed: ${message}`,
		fieldErrors: [{ path, message }],
	};
}

/**
 * Merges multiple ExtractionErrors into a single error.
 */
export function mergeErrors(...errors: ExtractionError[]): ExtractionError {
	const allFieldErrors = errors.flatMap((e) => e.fieldErrors);
	const count = allFieldErrors.length;
	return {
		message: `Extraction failed with ${String(count)} error${count === 1 ? "" : "s"}`,
		fieldErrors: allFieldErrors,
	};
}
