/**
 * Schema-aware coercion of CCLObject values to JavaScript types.
 *
 * Walks a Zod schema tree and a CCLObject in parallel, coercing string
 * leaf values to the types expected by the schema.
 *
 * @packageDocumentation
 */

import type { CCLList, CCLObject, CCLValue } from "ccl-ts";
import {
	ZodArray,
	ZodBoolean,
	ZodDefault,
	ZodEffects,
	ZodEnum,
	ZodLiteral,
	ZodNativeEnum,
	ZodNullable,
	ZodNumber,
	ZodObject,
	ZodOptional,
	ZodPipeline,
	ZodString,
	type ZodTypeAny,
} from "zod";
import { coercionError, type ExtractionError, mergeErrors } from "./errors.js";

/**
 * The result of coercing a CCLObject according to a Zod schema.
 * Either a successfully coerced value or an ExtractionError.
 */
type CoercionResult =
	| { success: true; value: unknown }
	| { success: false; error: ExtractionError };

function success(value: unknown): CoercionResult {
	return { success: true, value };
}

function failure(path: string[], message: string): CoercionResult {
	return { success: false, error: coercionError(path, message) };
}

/**
 * Unwraps wrapper Zod types (ZodOptional, ZodDefault, ZodNullable, ZodEffects,
 * ZodPipeline) to find the inner "real" schema type.
 */
function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
	if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
		return unwrapSchema(schema.unwrap());
	}
	if (schema instanceof ZodDefault) {
		return unwrapSchema(schema._def.innerType as ZodTypeAny);
	}
	if (schema instanceof ZodEffects) {
		return unwrapSchema(schema._def.schema as ZodTypeAny);
	}
	if (schema instanceof ZodPipeline) {
		// For pipelines, coerce according to the input schema
		return unwrapSchema(schema._def.in as ZodTypeAny);
	}
	return schema;
}

/**
 * Checks if a Zod schema is optional (wrapped in ZodOptional or ZodDefault).
 */
function isOptionalSchema(schema: ZodTypeAny): boolean {
	if (schema instanceof ZodOptional) {
		return true;
	}
	if (schema instanceof ZodDefault) {
		return true;
	}
	if (schema instanceof ZodNullable) {
		return isOptionalSchema(schema.unwrap());
	}
	return false;
}

/**
 * Coerces a CCL string value to a number.
 */
function coerceNumber(value: string, path: string[]): CoercionResult {
	const trimmed = value.trim();
	if (trimmed === "") {
		return failure(path, "Value is empty, cannot parse as number");
	}
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) {
		return failure(path, `Value is not a valid number: '${value}'`);
	}
	return success(parsed);
}

/**
 * Coerces a CCL string value to a boolean using CCL's lenient parsing.
 */
function coerceBoolean(value: string, path: string[]): CoercionResult {
	const normalized = value.trim().toLowerCase();
	switch (normalized) {
		case "true":
		case "yes":
		case "1":
			return success(true);
		case "false":
		case "no":
		case "0":
			return success(false);
		default:
			return failure(
				path,
				`Value is not a valid boolean: '${value}'. Expected one of: true, false, yes, no, 1, 0`,
			);
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerces a CCL list value, recursively coercing each item according to
 * the array's element schema.
 */
function coerceArray(value: CCLValue, elementSchema: ZodTypeAny, path: string[]): CoercionResult {
	let items: CCLList;

	if (Array.isArray(value)) {
		items = value;
	} else if (isPlainObject(value)) {
		// Check for bare-list syntax (empty-key list)
		const emptyKeyValue = (value as CCLObject)[""];
		if (Array.isArray(emptyKeyValue)) {
			items = emptyKeyValue;
		} else {
			return failure(path, "Value is not a list");
		}
	} else {
		return failure(path, "Value is not a list");
	}

	const results: unknown[] = [];
	const errors: ExtractionError[] = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const itemPath = [...path, String(i)];
		// biome-ignore lint/style/noNonNullAssertion: item is guaranteed to exist at this index
		const result = coerceValue(item!, elementSchema, itemPath);
		if (result.success) {
			results.push(result.value);
		} else {
			errors.push(result.error);
		}
	}

	if (errors.length > 0) {
		return { success: false, error: mergeErrors(...errors) };
	}

	return success(results);
}

/**
 * Coerces a CCLObject according to a ZodObject schema, recursively
 * coercing each field.
 */
function coerceObject(
	value: CCLValue,
	schema: ZodObject<Record<string, ZodTypeAny>>,
	path: string[],
): CoercionResult {
	if (!isPlainObject(value)) {
		return failure(path, `Expected an object but got ${typeof value}`);
	}

	const shape = schema.shape as Record<string, ZodTypeAny>;
	const result: Record<string, unknown> = {};
	const errors: ExtractionError[] = [];

	for (const [key, fieldSchema] of Object.entries(shape)) {
		const fieldPath = [...path, key];
		const fieldValue = (value as CCLObject)[key];

		if (fieldValue === undefined) {
			if (fieldSchema instanceof ZodDefault) {
				// Insert the default value directly — this avoids issues with
				// defaults on pipelines where Zod would feed the default value
				// as input to the pipeline (which expects a different type).
				result[key] = fieldSchema._def.defaultValue() as unknown;
				continue;
			}
			if (isOptionalSchema(fieldSchema)) {
				// Leave it out — Zod will mark as undefined
				continue;
			}
			errors.push(coercionError(fieldPath, "Required field is missing"));
			continue;
		}

		const coerced = coerceValue(fieldValue, fieldSchema, fieldPath);
		if (coerced.success) {
			result[key] = coerced.value;
		} else {
			errors.push(coerced.error);
		}
	}

	if (errors.length > 0) {
		return { success: false, error: mergeErrors(...errors) };
	}

	return success(result);
}

/**
 * Coerces a single CCL value according to a Zod schema.
 *
 * This is the core dispatch function that determines the coercion strategy
 * based on the schema's underlying type.
 */
export function coerceValue(value: CCLValue, schema: ZodTypeAny, path: string[]): CoercionResult {
	// Handle optional/nullable wrappers: if value is missing, let Zod handle it
	if (
		schema instanceof ZodOptional ||
		schema instanceof ZodDefault ||
		schema instanceof ZodNullable
	) {
		const inner =
			schema instanceof ZodDefault ? (schema._def.innerType as ZodTypeAny) : schema.unwrap();
		return coerceValue(value, inner, path);
	}

	// Handle pipelines — coerce according to the OUTPUT schema, since the
	// pipeline transforms input→output and we need the coerced value to
	// match the output type for post-coercion validation.
	if (schema instanceof ZodPipeline) {
		return coerceValue(value, schema._def.out as ZodTypeAny, path);
	}

	// Handle effects (transforms, refinements, preprocess) — coerce to the
	// output type. For transforms, the coercion layer substitutes the transform
	// logic (e.g., string→boolean for cclBoolean). For refinements, the inner
	// schema type matches the output type so this works correctly.
	if (schema instanceof ZodEffects) {
		const effect = schema._def.effect as { type: string };
		if (effect.type === "transform" || effect.type === "preprocess") {
			// The transform will be handled by our coercion dispatch below.
			// We need to determine the output type. For simple cases like
			// cclBoolean (string→boolean), the output is boolean. We can
			// check what the inner schema is and what the pipeline output
			// expects. Since effects don't have a typed output indicator,
			// we fall back to the inner schema for refinements.
			return coerceValue(value, schema._def.schema as ZodTypeAny, path);
		}
		// Refinements: coerce the inner schema
		return coerceValue(value, schema._def.schema as ZodTypeAny, path);
	}

	const innerSchema = unwrapSchema(schema);

	// String — pass through as-is
	if (innerSchema instanceof ZodString) {
		if (typeof value !== "string") {
			return failure(
				path,
				`Expected a string but got ${Array.isArray(value) ? "array" : "object"}`,
			);
		}
		return success(value);
	}

	// Number — coerce from string
	if (innerSchema instanceof ZodNumber) {
		if (typeof value !== "string") {
			return failure(path, `Expected a string value to coerce to number but got ${typeof value}`);
		}
		return coerceNumber(value, path);
	}

	// Boolean — CCL-style lenient coercion
	if (innerSchema instanceof ZodBoolean) {
		if (typeof value !== "string") {
			return failure(path, `Expected a string value to coerce to boolean but got ${typeof value}`);
		}
		return coerceBoolean(value, path);
	}

	// Enum — pass through as string, let Zod validate membership
	if (innerSchema instanceof ZodEnum) {
		if (typeof value !== "string") {
			return failure(path, `Expected a string for enum but got ${typeof value}`);
		}
		return success(value);
	}

	// Literal — pass through, let Zod validate
	if (innerSchema instanceof ZodLiteral) {
		if (typeof value !== "string") {
			return failure(path, `Expected a string for literal but got ${typeof value}`);
		}
		// Coerce to the literal's expected type if needed
		const literalValue = innerSchema._def.value as unknown;
		if (typeof literalValue === "number") {
			return coerceNumber(value, path);
		}
		if (typeof literalValue === "boolean") {
			return coerceBoolean(value, path);
		}
		return success(value);
	}

	// NativeEnum — pass through as string
	if (innerSchema instanceof ZodNativeEnum) {
		if (typeof value !== "string") {
			return failure(path, `Expected a string for enum but got ${typeof value}`);
		}
		return success(value);
	}

	// Array — coerce each element
	if (innerSchema instanceof ZodArray) {
		return coerceArray(value, innerSchema._def.type as ZodTypeAny, path);
	}

	// Object — recurse
	if (innerSchema instanceof ZodObject) {
		return coerceObject(value, innerSchema as ZodObject<Record<string, ZodTypeAny>>, path);
	}

	// For any unsupported Zod type, pass through the raw value and let Zod
	// handle validation. This provides a reasonable fallback.
	return success(value);
}

/**
 * Coerces a CCLObject according to a Zod object schema.
 *
 * This is the top-level coercion entry point used by `extract()`.
 */
export function coerceCCLObject(
	obj: CCLObject,
	schema: ZodObject<Record<string, ZodTypeAny>>,
): CoercionResult {
	return coerceObject(obj, schema, []);
}
