import { describe, expect, it } from "vitest";
import { categorizeSkipReason, generateTestResults } from "../../src/test-results.js";
import { TEST_DATA_PATH } from "../ccl/test-config.js";

// ---------------------------------------------------------------------------
// categorizeSkipReason
// ---------------------------------------------------------------------------

describe("categorizeSkipReason", () => {
	it("detects function category from 'function:' prefix", () => {
		expect(categorizeSkipReason("function:parse not supported")).toBe("function");
	});

	it("detects function category from 'Missing required functions' format", () => {
		expect(categorizeSkipReason("Missing required functions: parse, build_hierarchy")).toBe(
			"function",
		);
	});

	it("detects behavior category from 'Behavior conflict' format", () => {
		expect(
			categorizeSkipReason(
				"Behavior conflict: test requires boolean_strict, implementation uses boolean_lenient",
			),
		).toBe("behavior");
	});

	it("detects variant category from 'Variant mismatch' format", () => {
		expect(
			categorizeSkipReason(
				"Variant mismatch: test requires proposed_behavior, implementation uses reference_compliant",
			),
		).toBe("variant");
	});

	it("detects explicit skips", () => {
		expect(categorizeSkipReason("Explicitly skipped via skipTests")).toBe("explicit");
	});

	it("returns 'other' for unrecognized reasons", () => {
		expect(categorizeSkipReason("some unknown reason")).toBe("other");
	});

	it("detects conflict category", () => {
		expect(categorizeSkipReason("Function conflict: test conflicts with compose")).toBe("conflict");
	});

	it("detects behavior category from 'Missing behavior' format", () => {
		expect(categorizeSkipReason("Missing behavior: path_traversal")).toBe("behavior");
	});
});

// ---------------------------------------------------------------------------
// generateTestResults (integration)
// ---------------------------------------------------------------------------

function stubParse(input: string): Array<{ key: string; value: string }> {
	const entries: Array<{ key: string; value: string }> = [];
	for (const line of input.split("\n")) {
		const eqIdx = line.indexOf("=");
		if (eqIdx >= 0) {
			entries.push({ key: line.slice(0, eqIdx).trim(), value: line.slice(eqIdx + 1).trim() });
		}
	}
	return entries;
}

const baseConfig = {
	name: "test-stub",
	version: "0.0.1",
	testDataPath: TEST_DATA_PATH,
	functions: { parse: stubParse },
	behaviors: [
		"boolean_lenient",
		"crlf_normalize_to_lf",
		"tabs_as_content",
		"delimiter_first_equals",
		"list_coercion_disabled",
	],
	variant: "proposed_behavior",
} as const;

describe("generateTestResults", () => {
	it("returns a document with the expected top-level shape", async () => {
		const results = await generateTestResults({ config: baseConfig, language: "typescript" });

		expect(results.$schema).toContain("test-results-format");
		expect(results.generatedAt).toBeTruthy();
		expect(results.implementation).toBeDefined();
		expect(results.testSuite).toBeDefined();
		expect(Array.isArray(results.tests)).toBe(true);
	});

	it("populates implementation identity correctly", async () => {
		const results = await generateTestResults({ config: baseConfig, language: "typescript" });

		expect(results.implementation.name).toBe("test-stub");
		expect(results.implementation.version).toBe("0.0.1");
		expect(results.implementation.language).toBe("typescript");
		expect(results.implementation.variant).toBe("proposed_behavior");
		expect(results.implementation.implementedFunctions).toContain("parse");
	});

	it("testSuite.totalTests equals tests.length", async () => {
		const results = await generateTestResults({ config: baseConfig, language: "typescript" });

		expect(results.testSuite.totalTests).toBe(results.tests.length);
	});

	it("produces a non-empty tests array", async () => {
		const results = await generateTestResults({ config: baseConfig, language: "typescript" });

		expect(results.tests.length).toBeGreaterThan(0);
	});

	it("every test outcome has required fields", async () => {
		const results = await generateTestResults({ config: baseConfig, language: "typescript" });

		for (const t of results.tests) {
			expect(t.name).toBeTruthy();
			expect(t.validation).toBeTruthy();
			expect(["pass", "fail", "skip", "todo"]).toContain(t.outcome);
			expect(Array.isArray(t.behaviors)).toBe(true);
			expect(Array.isArray(t.features)).toBe(true);
			expect(Array.isArray(t.variants)).toBe(true);
		}
	});

	it("skipped tests have a reason", async () => {
		const results = await generateTestResults({ config: baseConfig, language: "typescript" });
		const skipped = results.tests.filter((t) => t.outcome === "skip");

		expect(skipped.length).toBeGreaterThan(0);
		for (const t of skipped) {
			expect(t.reason).toBeTruthy();
		}
	});

	it("produces a valid generatedAt timestamp", async () => {
		const before = new Date().toISOString();
		const results = await generateTestResults({ config: baseConfig, language: "typescript" });
		const after = new Date().toISOString();

		expect(() => new Date(results.generatedAt)).not.toThrow();
		expect(results.generatedAt >= before).toBe(true);
		expect(results.generatedAt <= after).toBe(true);
	});

	it("consumer can derive per-function counts from tests", async () => {
		const results = await generateTestResults({ config: baseConfig, language: "typescript" });

		// Simulate what a consumer would do: group by validation
		const byFn: Record<string, number> = {};
		for (const t of results.tests) {
			byFn[t.validation] = (byFn[t.validation] ?? 0) + 1;
		}

		// All per-function totals must sum to tests.length
		const total = Object.values(byFn).reduce((sum, n) => sum + n, 0);
		expect(total).toBe(results.tests.length);

		// parse must appear since it's the only implemented function
		expect(byFn.parse).toBeGreaterThan(0);
	});

	it("consumer can derive summary counts from tests", async () => {
		const results = await generateTestResults({ config: baseConfig, language: "typescript" });

		const counts = { pass: 0, fail: 0, skip: 0, todo: 0 };
		for (const t of results.tests) counts[t.outcome]++;

		expect(counts.pass + counts.fail + counts.skip + counts.todo).toBe(results.tests.length);
		expect(counts.skip).toBeGreaterThan(0);
	});
});
