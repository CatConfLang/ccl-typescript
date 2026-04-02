import { buildHierarchy, parse } from "ccl-ts";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { cclBoolean, extract } from "../src/index.js";

/**
 * Helper: parse CCL text and build hierarchy, asserting success.
 */
function parseCCL(text: string) {
	const entries = parse(text);
	if (entries.isErr) {
		throw new Error(`Parse failed: ${entries.error.message}`);
	}
	const obj = buildHierarchy(entries.value);
	if (obj.isErr) {
		throw new Error(`Build hierarchy failed: ${obj.error.message}`);
	}
	return obj.value;
}

describe("extract", () => {
	describe("flat objects", () => {
		it("extracts string fields", () => {
			const obj = parseCCL("name = Alice\ngreeting = hello world");
			const schema = z.object({
				name: z.string(),
				greeting: z.string(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ name: "Alice", greeting: "hello world" });
			}
		});

		it("extracts number fields", () => {
			const obj = parseCCL("port = 8080\nratio = 3.14");
			const schema = z.object({
				port: z.number().int(),
				ratio: z.number(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ port: 8080, ratio: 3.14 });
			}
		});

		it("extracts boolean fields with CCL-style coercion", () => {
			const obj = parseCCL("debug = true\nverbose = yes\nstrict = 1");
			const schema = z.object({
				debug: z.boolean(),
				verbose: z.boolean(),
				strict: z.boolean(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ debug: true, verbose: true, strict: true });
			}
		});

		it("extracts false boolean variants", () => {
			const obj = parseCCL("a = false\nb = no\nc = 0");
			const schema = z.object({
				a: z.boolean(),
				b: z.boolean(),
				c: z.boolean(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ a: false, b: false, c: false });
			}
		});

		it("handles mixed types", () => {
			const obj = parseCCL("name = myapp\nport = 3000\ndebug = no");
			const schema = z.object({
				name: z.string(),
				port: z.number().int(),
				debug: z.boolean(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ name: "myapp", port: 3000, debug: false });
			}
		});
	});

	describe("nested objects", () => {
		it("extracts nested object fields", () => {
			const obj = parseCCL("server =\n  host = localhost\n  port = 8080");
			const schema = z.object({
				server: z.object({
					host: z.string(),
					port: z.number().int(),
				}),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({
					server: { host: "localhost", port: 8080 },
				});
			}
		});

		it("extracts deeply nested objects", () => {
			const obj = parseCCL(
				"app =\n  server =\n    connection =\n      host = 127.0.0.1\n      port = 5432",
			);
			const schema = z.object({
				app: z.object({
					server: z.object({
						connection: z.object({
							host: z.string(),
							port: z.number(),
						}),
					}),
				}),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value.app.server.connection).toEqual({
					host: "127.0.0.1",
					port: 5432,
				});
			}
		});

		it("mixes nested and flat fields", () => {
			const obj = parseCCL("name = myapp\ndb =\n  host = localhost\n  port = 5432");
			const schema = z.object({
				name: z.string(),
				db: z.object({
					host: z.string(),
					port: z.number(),
				}),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({
					name: "myapp",
					db: { host: "localhost", port: 5432 },
				});
			}
		});
	});

	describe("optional fields", () => {
		it("handles present optional fields", () => {
			const obj = parseCCL("name = Alice\nage = 30");
			const schema = z.object({
				name: z.string(),
				age: z.number().optional(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ name: "Alice", age: 30 });
			}
		});

		it("handles missing optional fields", () => {
			const obj = parseCCL("name = Alice");
			const schema = z.object({
				name: z.string(),
				age: z.number().optional(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ name: "Alice" });
				expect(result.value.age).toBeUndefined();
			}
		});
	});

	describe("default values", () => {
		it("uses default when field is missing", () => {
			const obj = parseCCL("name = Alice");
			const schema = z.object({
				name: z.string(),
				retries: z.number().default(3),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ name: "Alice", retries: 3 });
			}
		});

		it("uses provided value over default", () => {
			const obj = parseCCL("name = Alice\nretries = 5");
			const schema = z.object({
				name: z.string(),
				retries: z.number().default(3),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ name: "Alice", retries: 5 });
			}
		});

		it("uses default for boolean fields", () => {
			const obj = parseCCL("name = Alice");
			const schema = z.object({
				name: z.string(),
				debug: z.boolean().default(false),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ name: "Alice", debug: false });
			}
		});
	});

	describe("cclBoolean schema", () => {
		it("accepts 'yes' and 'no'", () => {
			const obj = parseCCL("enabled = yes\ndisabled = no");
			const schema = z.object({
				enabled: cclBoolean(),
				disabled: cclBoolean(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ enabled: true, disabled: false });
			}
		});

		it("accepts '1' and '0'", () => {
			const obj = parseCCL("a = 1\nb = 0");
			const schema = z.object({
				a: cclBoolean(),
				b: cclBoolean(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ a: true, b: false });
			}
		});

		it("is case-insensitive", () => {
			const obj = parseCCL("a = TRUE\nb = Yes\nc = False");
			const schema = z.object({
				a: cclBoolean(),
				b: cclBoolean(),
				c: cclBoolean(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({ a: true, b: true, c: false });
			}
		});

		it("rejects invalid boolean values", () => {
			const obj = parseCCL("flag = maybe");
			const schema = z.object({
				flag: cclBoolean(),
			});
			const result = extract(obj, schema);
			expect(result.isErr).toBe(true);
		});

		it("works with optional", () => {
			const obj = parseCCL("name = test");
			const schema = z.object({
				name: z.string(),
				flag: cclBoolean().optional(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value.flag).toBeUndefined();
			}
		});

		it("works with default", () => {
			const obj = parseCCL("name = test");
			const schema = z.object({
				name: z.string(),
				flag: cclBoolean().default(true),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value.flag).toBe(true);
			}
		});
	});

	describe("enum fields", () => {
		it("extracts valid enum values", () => {
			const obj = parseCCL("level = info");
			const schema = z.object({
				level: z.enum(["debug", "info", "warn", "error"]),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value.level).toBe("info");
			}
		});

		it("rejects invalid enum values", () => {
			const obj = parseCCL("level = trace");
			const schema = z.object({
				level: z.enum(["debug", "info", "warn", "error"]),
			});
			const result = extract(obj, schema);
			expect(result.isErr).toBe(true);
		});
	});

	describe("arrays / lists", () => {
		it("extracts lists from duplicate keys", () => {
			const obj = parseCCL("color = red\ncolor = green\ncolor = blue");
			const schema = z.object({
				color: z.array(z.string()),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value.color).toEqual(["red", "green", "blue"]);
			}
		});
	});

	describe("Zod refinements", () => {
		it("applies .positive() refinement", () => {
			const obj = parseCCL("port = -1");
			const schema = z.object({
				port: z.number().int().positive(),
			});
			const result = extract(obj, schema);
			expect(result.isErr).toBe(true);
			if (result.isErr) {
				expect(result.error.fieldErrors.length).toBeGreaterThan(0);
			}
		});

		it("applies .min() / .max() on strings", () => {
			const obj = parseCCL("name = ab");
			const schema = z.object({
				name: z.string().min(3),
			});
			const result = extract(obj, schema);
			expect(result.isErr).toBe(true);
		});
	});

	describe("error collection", () => {
		it("collects multiple field errors", () => {
			const obj = parseCCL("name = x\nport = notanumber\ndebug = maybe");
			const schema = z.object({
				name: z.string().min(3),
				port: z.number(),
				debug: z.boolean(),
			});
			const result = extract(obj, schema);
			expect(result.isErr).toBe(true);
			if (result.isErr) {
				// Should have errors for port (coercion) and debug (coercion)
				// name passes coercion but may fail Zod validation
				expect(result.error.fieldErrors.length).toBeGreaterThanOrEqual(2);
			}
		});

		it("reports missing required fields", () => {
			const obj = parseCCL("name = Alice");
			const schema = z.object({
				name: z.string(),
				port: z.number(),
			});
			const result = extract(obj, schema);
			expect(result.isErr).toBe(true);
			if (result.isErr) {
				const portError = result.error.fieldErrors.find((e) => e.path.includes("port"));
				expect(portError).toBeDefined();
			}
		});

		it("error has descriptive message", () => {
			const obj = parseCCL("name = Alice");
			const schema = z.object({
				name: z.string(),
				port: z.number(),
			});
			const result = extract(obj, schema);
			expect(result.isErr).toBe(true);
			if (result.isErr) {
				expect(result.error.message).toContain("failed");
				expect(result.error.fieldErrors.length).toBeGreaterThan(0);
			}
		});
	});

	describe("edge cases", () => {
		it("handles empty schema", () => {
			const obj = parseCCL("name = Alice");
			const schema = z.object({});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value).toEqual({});
			}
		});

		it("handles whitespace in numeric values", () => {
			const obj = parseCCL("port =   8080  ");
			const schema = z.object({
				port: z.number(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value.port).toBe(8080);
			}
		});

		it("handles whitespace in boolean values", () => {
			const obj = parseCCL("flag =   yes  ");
			const schema = z.object({
				flag: z.boolean(),
			});
			const result = extract(obj, schema);
			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(result.value.flag).toBe(true);
			}
		});

		it("rejects non-finite numbers", () => {
			const obj = parseCCL("value = Infinity");
			const schema = z.object({
				value: z.number(),
			});
			const result = extract(obj, schema);
			expect(result.isErr).toBe(true);
		});

		it("rejects empty string as number", () => {
			const obj = parseCCL("value =");
			const schema = z.object({
				value: z.number(),
			});
			const result = extract(obj, schema);
			expect(result.isErr).toBe(true);
		});
	});
});
