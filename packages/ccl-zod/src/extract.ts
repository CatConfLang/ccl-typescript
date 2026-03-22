/**
 * The main `extract` function for ccl-zod.
 *
 * Coerces a CCLObject's string values to JavaScript types according to a
 * Zod schema, validates the result, and returns a fully-typed object.
 *
 * @packageDocumentation
 */

import type { CCLObject } from "ccl-ts";
import { err, ok, type Result } from "true-myth/result";
import {
	ZodArray,
	ZodDefault,
	ZodEffects,
	ZodNullable,
	ZodObject,
	ZodOptional,
	ZodPipeline,
	type ZodTypeAny,
	type z,
} from "zod";
import { coerceCCLObject } from "./coerce.js";
import { type ExtractionError, mapZodError } from "./errors.js";

/**
 * Builds a validation-only schema from the original schema, suitable for
 * validating already-coerced data.
 *
 * Replaces ZodPipeline and ZodEffects (transforms) with their output types
 * so that Zod doesn't try to re-run transforms on already-coerced values.
 */
function buildValidationSchema(schema: ZodTypeAny): ZodTypeAny {
	// Pipeline: use the output schema (already coerced to output type)
	if (schema instanceof ZodPipeline) {
		return buildValidationSchema(schema._def.out as ZodTypeAny);
	}

	// Effects (transforms, refinements, preprocess): for transforms, use the
	// inner schema's output type. For refinements, keep them.
	if (schema instanceof ZodEffects) {
		const effect = schema._def.effect as { type: string };
		if (effect.type === "transform" || effect.type === "preprocess") {
			// Transforms have already been applied by the coercion layer.
			// Fall through to the inner schema, but note that the output type
			// may differ from the input. For safety, we just use the inner schema
			// which will validate the pre-transform type. Since coercion already
			// applied the transform, we rely on the pipeline's output schema
			// (handled above) for proper validation.
			return buildValidationSchema(schema._def.schema as ZodTypeAny);
		}
		// Refinements should be kept — they validate constraints
		return schema;
	}

	// Default: simplify the inner type
	if (schema instanceof ZodDefault) {
		const inner = buildValidationSchema(schema._def.innerType as ZodTypeAny);
		return inner.default(schema._def.defaultValue() as unknown) as ZodTypeAny;
	}

	// Optional: simplify the inner type
	if (schema instanceof ZodOptional) {
		return buildValidationSchema(schema.unwrap()).optional() as ZodTypeAny;
	}

	// Nullable: simplify the inner type
	if (schema instanceof ZodNullable) {
		return buildValidationSchema(schema.unwrap()).nullable() as ZodTypeAny;
	}

	// Array: simplify the element type
	if (schema instanceof ZodArray) {
		return buildValidationSchema(schema._def.type as ZodTypeAny).array() as ZodTypeAny;
	}

	// Object: recurse into shape
	if (schema instanceof ZodObject) {
		const shape = schema.shape as Record<string, ZodTypeAny>;
		const newShape: Record<string, ZodTypeAny> = {};
		for (const [key, fieldSchema] of Object.entries(shape)) {
			newShape[key] = buildValidationSchema(fieldSchema);
		}
		return (schema.constructor as typeof ZodObject).create(newShape) as unknown as ZodTypeAny;
	}

	// Everything else (ZodString, ZodNumber, ZodBoolean with refinements, etc.)
	// passes through unchanged.
	return schema;
}

/**
 * Extracts a typed object from a CCLObject using a Zod schema.
 *
 * Coerces CCL string values to JavaScript types (numbers, booleans, etc.)
 * based on the schema, then validates the coerced data through Zod's
 * validation pipeline. Returns a `Result` with either the typed object or
 * an `ExtractionError` collecting all field-level failures.
 *
 * @param obj - The CCLObject to extract values from (output of `buildHierarchy`)
 * @param schema - A Zod object schema defining the expected shape
 * @returns A Result containing either the typed object or an ExtractionError
 *
 * @example
 * ```typescript
 * import { parse, buildHierarchy } from "ccl-ts";
 * import { z } from "zod";
 * import { extract } from "ccl-zod";
 *
 * const schema = z.object({
 *   host: z.string(),
 *   port: z.number().int().positive(),
 * });
 *
 * const entries = parse("host = localhost\nport = 8080");
 * if (entries.isOk) {
 *   const obj = buildHierarchy(entries.value);
 *   if (obj.isOk) {
 *     const result = extract(obj.value, schema);
 *     if (result.isOk) {
 *       console.log(result.value.host); // "localhost"
 *       console.log(result.value.port); // 8080
 *     }
 *   }
 * }
 * ```
 *
 * @beta
 */
export function extract<T extends ZodObject<Record<string, ZodTypeAny>>>(
	obj: CCLObject,
	schema: T,
): Result<z.infer<T>, ExtractionError> {
	// Phase 1: Coerce CCL string values to JS types based on the schema
	const coerced = coerceCCLObject(obj, schema as ZodObject<Record<string, ZodTypeAny>>);

	if (!coerced.success) {
		return err(coerced.error);
	}

	// Phase 2: Build a validation-only schema that won't re-run transforms/pipelines
	const validationSchema = buildValidationSchema(schema);

	// Phase 3: Validate the coerced object
	const parsed = validationSchema.safeParse(coerced.value);

	if (!parsed.success) {
		return err(mapZodError(parsed.error));
	}

	return ok(parsed.data as z.infer<T>);
}
