/**
 * Throwing API for ccl-ts.
 *
 * This module provides CCL functions that use standard JavaScript error
 * handling (throwing) instead of Result types. The core parser throws
 * natively, so this module is a zero-overhead re-export — no true-myth
 * dependency is pulled in.
 *
 * @example
 * ```typescript
 * import { parse, buildHierarchy, getString, CCLAccessError } from "ccl-ts/throwing";
 *
 * try {
 *   const entries = parse("name=Alice\nage=30");
 *   const obj = buildHierarchy(entries);
 *   const name = getString(obj, "name"); // "Alice"
 * } catch (e) {
 *   if (e instanceof CCLAccessError) {
 *     console.error(`Access error at ${e.path.join(".")}: ${e.message}`);
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// Re-export all functions directly from the core (which throws natively)
export {
	buildHierarchy,
	canonicalFormat,
	compose,
	getBool,
	getFloat,
	getInt,
	getList,
	getString,
	parse,
	print,
} from "./ccl.js";

// Re-export error classes
export { CCLAccessError, CCLParseError } from "./errors.js";

// Re-export CCL types so consumers only need one import path
export type {
	AccessError,
	CCLList,
	CCLListItem,
	CCLObject,
	CCLValue,
	Entry,
	GetBoolOptions,
	GetListOptions,
	ParseError,
} from "./types.js";
