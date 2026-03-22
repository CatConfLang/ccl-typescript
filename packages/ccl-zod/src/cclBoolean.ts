/**
 * CCL-aware boolean Zod schema.
 *
 * Accepts CCL-style boolean strings: true/false, yes/no, 1/0 (case-insensitive)
 * and transforms them into actual boolean values.
 *
 * @packageDocumentation
 */

import { z } from "zod";

const CCL_TRUE_VALUES = new Set(["true", "yes", "1"]);
const CCL_FALSE_VALUES = new Set(["false", "no", "0"]);

/**
 * A Zod schema that accepts CCL-style boolean strings and transforms them to booleans.
 *
 * Accepts (case-insensitive): `true`, `false`, `yes`, `no`, `1`, `0`.
 *
 * @example
 * ```typescript
 * import { cclBoolean } from "ccl-zod";
 *
 * const schema = z.object({ debug: cclBoolean() });
 * schema.parse({ debug: "yes" }); // { debug: true }
 * ```
 *
 * @beta
 */
export function cclBoolean(): z.ZodPipeline<
	z.ZodEffects<z.ZodString, boolean, string>,
	z.ZodBoolean
> {
	return z
		.string()
		.transform((val, ctx) => {
			const normalized = val.trim().toLowerCase();
			if (CCL_TRUE_VALUES.has(normalized)) {
				return true;
			}
			if (CCL_FALSE_VALUES.has(normalized)) {
				return false;
			}
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Invalid CCL boolean value: '${val}'. Expected one of: true, false, yes, no, 1, 0`,
			});
			return z.NEVER;
		})
		.pipe(z.boolean());
}
