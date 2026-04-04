/**
 * ccl-ts - TypeScript CCL (Categorical Configuration Language) parser.
 *
 * This package provides a CCL parser implementation in TypeScript.
 * See https://ccl.tylerbutler.com for the CCL specification.
 *
 * All functions that can fail return Result types from true-myth.
 * Use `.isOk` / `.isErr` to check success, or `.match()` for pattern matching.
 *
 * @packageDocumentation
 */

import { err, ok, type Result } from "true-myth/result";
import {
	buildHierarchy as buildHierarchyInternal,
	canonicalFormat as canonicalFormatInternal,
	getBool as getBoolInternal,
	getFloat as getFloatInternal,
	getInt as getIntInternal,
	getList as getListInternal,
	getString as getStringInternal,
	parseIndented as parseIndentedInternal,
	parse as parseInternal,
} from "./ccl.js";
import { CCLAccessError, CCLParseError } from "./errors.js";
import type {
	AccessError,
	BuildHierarchyOptions,
	CCLList,
	CCLObject,
	Entry,
	GetBoolOptions,
	GetListOptions,
	ParseError,
	ParseOptions,
} from "./types.js";

// Result types from true-myth
export type { Err, Ok } from "true-myth/result";
export { err, ok, Result } from "true-myth/result";
// Re-export direct helpers that never fail
export { compose, filter, print } from "./ccl.js";

// Error classes (usable with both Result and throwing APIs)
export { CCLAccessError, CCLParseError } from "./errors.js";

// CCL types
export type {
	AccessError,
	BuildHierarchyOptions,
	CCLList,
	CCLListItem,
	CCLObject,
	CCLValue,
	CrlfHandling,
	Entry,
	GetBoolOptions,
	GetListOptions,
	ParseError,
	ParseOptions,
	TabHandling,
} from "./types.js";

/**
 * Wrap a throwing function into a Result-returning function.
 * Catches CCLParseError and CCLAccessError, converting them to err() Results.
 */
function wrapResult<T, E extends ParseError | AccessError>(
	fn: () => T,
	extractError: (e: CCLParseError | CCLAccessError) => E,
): Result<T, E> {
	try {
		return ok(fn());
	} catch (e) {
		if (e instanceof CCLParseError || e instanceof CCLAccessError) {
			return err(extractError(e));
		}
		throw e;
	}
}

function toParseError(e: CCLParseError | CCLAccessError): ParseError {
	if (e instanceof CCLParseError) {
		const result: ParseError = { message: e.message };
		if (e.line !== undefined) result.line = e.line;
		if (e.column !== undefined) result.column = e.column;
		return result;
	}
	return { message: e.message };
}

function toAccessError(e: CCLParseError | CCLAccessError): AccessError {
	if (e instanceof CCLAccessError) {
		return { message: e.message, path: e.path };
	}
	return { message: e.message, path: [] };
}

/**
 * Parse CCL text into an array of key-value entries.
 *
 * @beta
 */
export function parse(text: string, options?: ParseOptions): Result<Entry[], ParseError> {
	return wrapResult(() => parseInternal(text, options), toParseError);
}

/**
 * Parse CCL text with indentation normalization.
 *
 * @beta
 */
export function parseIndented(text: string, options?: ParseOptions): Result<Entry[], ParseError> {
	return wrapResult(() => parseIndentedInternal(text, options), toParseError);
}

/**
 * Build a hierarchical CCL object from flat entries.
 *
 * @beta
 */
export function buildHierarchy(
	entries: Entry[],
	options?: BuildHierarchyOptions,
): Result<CCLObject, ParseError> {
	return wrapResult(() => buildHierarchyInternal(entries, options), toParseError);
}

/**
 * Get a string value from a CCL object by path.
 *
 * @beta
 */
export function getString(obj: CCLObject, ...pathParts: string[]): Result<string, AccessError> {
	return wrapResult(() => getStringInternal(obj, ...pathParts), toAccessError);
}

/**
 * Get an integer value from a CCL object by path.
 *
 * @beta
 */
export function getInt(obj: CCLObject, ...pathParts: string[]): Result<number, AccessError> {
	return wrapResult(() => getIntInternal(obj, ...pathParts), toAccessError);
}

/**
 * Get a boolean value from a CCL object by path.
 *
 * @beta
 */
export function getBool(
	obj: CCLObject,
	pathParts: string[],
	options?: GetBoolOptions,
): Result<boolean, AccessError> {
	return wrapResult(() => getBoolInternal(obj, pathParts, options), toAccessError);
}

/**
 * Get a float value from a CCL object by path.
 *
 * @beta
 */
export function getFloat(obj: CCLObject, ...pathParts: string[]): Result<number, AccessError> {
	return wrapResult(() => getFloatInternal(obj, ...pathParts), toAccessError);
}

/**
 * Get a list value from a CCL object by path.
 *
 * @beta
 */
export function getList(
	obj: CCLObject,
	pathParts: string[],
	options?: GetListOptions,
): Result<CCLList, AccessError> {
	return wrapResult(() => getListInternal(obj, pathParts, options), toAccessError);
}

/**
 * Convert CCL text to canonical format.
 *
 * @beta
 */
export function canonicalFormat(input: string, options?: ParseOptions): Result<string, ParseError> {
	return wrapResult(() => canonicalFormatInternal(input, options), toParseError);
}
