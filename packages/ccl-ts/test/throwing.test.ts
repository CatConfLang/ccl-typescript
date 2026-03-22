/**
 * Tests for the throwing API (ccl-ts/throwing).
 */

import { describe, expect, it } from "vitest";
import {
	buildHierarchy,
	CCLAccessError,
	CCLParseError,
	canonicalFormat,
	getBool,
	getFloat,
	getInt,
	getList,
	getString,
	parse,
	print,
} from "../src/throwing.js";

const VALID_CCL = `name=Alice
age=30
active=true
score=3.14
tags=one
tags=two
tags=three`;

describe("throwing API", () => {
	describe("CCLParseError", () => {
		it("is a proper Error subclass with expected properties", () => {
			const error = new CCLParseError({
				message: "test error",
				line: 5,
				column: 10,
			});
			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(CCLParseError);
			expect(error.name).toBe("CCLParseError");
			expect(error.message).toBe("test error");
			expect(error.line).toBe(5);
			expect(error.column).toBe(10);
			expect(error.stack).toBeTruthy();
		});
	});

	describe("parse", () => {
		it("parses valid CCL text", () => {
			const entries = parse(VALID_CCL);
			expect(entries).toBeInstanceOf(Array);
			expect(entries.length).toBeGreaterThan(0);
			expect(entries[0]).toHaveProperty("key", "name");
			expect(entries[0]).toHaveProperty("value", "Alice");
		});
	});

	describe("buildHierarchy", () => {
		it("builds hierarchy from entries", () => {
			const entries = parse("name=Alice");
			const obj = buildHierarchy(entries);
			expect(obj).toHaveProperty("name", "Alice");
		});
	});

	describe("getString", () => {
		it("returns string value", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			expect(getString(obj, "name")).toBe("Alice");
		});

		it("throws CCLAccessError for missing key", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			expect(() => getString(obj, "missing")).toThrow(CCLAccessError);
		});

		it("CCLAccessError has expected properties", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			try {
				getString(obj, "missing");
				expect.fail("should have thrown");
			} catch (e) {
				expect(e).toBeInstanceOf(CCLAccessError);
				expect(e).toBeInstanceOf(Error);
				const error = e as CCLAccessError;
				expect(error.name).toBe("CCLAccessError");
				expect(error.message).toBeTruthy();
				expect(error.path).toEqual(["missing"]);
				expect(error.stack).toBeTruthy();
			}
		});
	});

	describe("getInt", () => {
		it("returns integer value", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			expect(getInt(obj, "age")).toBe(30);
		});

		it("throws CCLAccessError for non-integer value", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			expect(() => getInt(obj, "name")).toThrow(CCLAccessError);
		});
	});

	describe("getBool", () => {
		it("returns boolean value", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			expect(getBool(obj, "active")).toBe(true);
		});

		it("throws CCLAccessError for non-boolean value", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			expect(() => getBool(obj, "name")).toThrow(CCLAccessError);
		});
	});

	describe("getFloat", () => {
		it("returns float value", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			expect(getFloat(obj, "score")).toBe(3.14);
		});

		it("throws CCLAccessError for non-numeric value", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			expect(() => getFloat(obj, "name")).toThrow(CCLAccessError);
		});
	});

	describe("getList", () => {
		it("returns list value", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			const list = getList(obj, "tags");
			expect(list).toEqual(["one", "two", "three"]);
		});

		it("throws CCLAccessError for non-list value", () => {
			const obj = buildHierarchy(parse(VALID_CCL));
			expect(() => getList(obj, "name")).toThrow(CCLAccessError);
		});
	});

	describe("canonicalFormat", () => {
		it("formats valid CCL to canonical form", () => {
			const result = canonicalFormat("name=Alice");
			expect(result).toContain("name");
			expect(result).toContain("Alice");
		});
	});

	describe("print", () => {
		it("prints entries back to CCL text", () => {
			const entries = parse("name=Alice");
			const text = print(entries);
			expect(text).toContain("name");
			expect(text).toContain("Alice");
		});
	});
});
