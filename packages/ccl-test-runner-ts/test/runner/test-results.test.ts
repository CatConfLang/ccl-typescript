import { describe, expect, it } from "vitest";
import type { TestCase } from "../../src/schema-validation.js";
import {
	aggregateResults,
	categorizeSkipReason,
	computeMetrics,
	generateTestResults,
	type TestSummary,
} from "../../src/test-results.js";
import { TEST_DATA_PATH } from "../ccl/test-config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTestCase(overrides: Partial<TestCase> = {}): TestCase {
	return {
		name: "mock_test",
		inputs: ["key = value"],
		validation: "parse",
		expected: { count: 1 },
		behaviors: [],
		variants: [],
		features: [],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// computeMetrics
// ---------------------------------------------------------------------------

describe("computeMetrics", () => {
	it("computes all metrics for a normal summary", () => {
		const summary: TestSummary = {
			totalTests: 100,
			passed: 80,
			failed: 5,
			skipped: 10,
			todo: 5,
			skipReasons: {},
		};
		const metrics = computeMetrics(summary);

		expect(metrics.passRate).toBeCloseTo(80 / 85); // 80 / (80 + 5)
		expect(metrics.coverage).toBeCloseTo(90 / 100); // (100 - 10) / 100
		expect(metrics.completeness).toBeCloseTo(85 / 90); // (80 + 5) / (100 - 10)
		expect(metrics.overallScore).toBeCloseTo(80 / 100);
	});

	it("returns null passRate when no tests ran", () => {
		const summary: TestSummary = {
			totalTests: 50,
			passed: 0,
			failed: 0,
			skipped: 40,
			todo: 10,
			skipReasons: {},
		};
		const metrics = computeMetrics(summary);

		expect(metrics.passRate).toBeNull();
		expect(metrics.coverage).toBeCloseTo(10 / 50);
		expect(metrics.completeness).toBeCloseTo(0); // 0 / 10
		expect(metrics.overallScore).toBeCloseTo(0);
	});

	it("returns null coverage and overallScore when totalTests is 0", () => {
		const summary: TestSummary = {
			totalTests: 0,
			passed: 0,
			failed: 0,
			skipped: 0,
			todo: 0,
			skipReasons: {},
		};
		const metrics = computeMetrics(summary);

		expect(metrics.passRate).toBeNull();
		expect(metrics.coverage).toBeNull();
		expect(metrics.completeness).toBeNull();
		expect(metrics.overallScore).toBeNull();
	});

	it("returns null completeness when all tests are skipped", () => {
		const summary: TestSummary = {
			totalTests: 50,
			passed: 0,
			failed: 0,
			skipped: 50,
			todo: 0,
			skipReasons: {},
		};
		const metrics = computeMetrics(summary);

		expect(metrics.passRate).toBeNull();
		expect(metrics.coverage).toBeCloseTo(0);
		expect(metrics.completeness).toBeNull();
		expect(metrics.overallScore).toBeCloseTo(0);
	});

	it("returns 1.0 passRate when all ran tests pass", () => {
		const summary: TestSummary = {
			totalTests: 100,
			passed: 90,
			failed: 0,
			skipped: 5,
			todo: 5,
			skipReasons: {},
		};
		const metrics = computeMetrics(summary);

		expect(metrics.passRate).toBe(1);
	});
});

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
// aggregateResults
// ---------------------------------------------------------------------------

/**
 * Input shape for aggregateResults — each test with its categorization outcome.
 */
interface CategorizedTest {
	testCase: TestCase;
	outcome: "pass" | "fail" | "skip" | "todo";
	reason?: string;
	error?: string;
}

describe("aggregateResults", () => {
	it("counts passed, failed, skipped, and todo correctly", () => {
		const tests: CategorizedTest[] = [
			{ testCase: createMockTestCase({ name: "t1" }), outcome: "pass" },
			{ testCase: createMockTestCase({ name: "t2" }), outcome: "pass" },
			{ testCase: createMockTestCase({ name: "t3" }), outcome: "fail", error: "mismatch" },
			{
				testCase: createMockTestCase({ name: "t4" }),
				outcome: "skip",
				reason: "function:compose not supported",
			},
			{
				testCase: createMockTestCase({ name: "t5" }),
				outcome: "todo",
				reason: "function:expand_dotted declared but not implemented",
			},
		];

		const result = aggregateResults(tests);

		expect(result.summary.totalTests).toBe(5);
		expect(result.summary.passed).toBe(2);
		expect(result.summary.failed).toBe(1);
		expect(result.summary.skipped).toBe(1);
		expect(result.summary.todo).toBe(1);
	});

	it("accumulates skipReasons by category", () => {
		const tests: CategorizedTest[] = [
			{
				testCase: createMockTestCase({ name: "t1" }),
				outcome: "skip",
				reason: "function:compose not supported",
			},
			{
				testCase: createMockTestCase({ name: "t2" }),
				outcome: "skip",
				reason: "function:load not supported",
			},
			{
				testCase: createMockTestCase({ name: "t3" }),
				outcome: "skip",
				reason:
					"Behavior conflict: test requires boolean_strict, implementation uses boolean_lenient",
			},
		];

		const result = aggregateResults(tests);

		expect(result.summary.skipReasons.function).toBe(2);
		expect(result.summary.skipReasons.behavior).toBe(1);
	});

	it("groups results by validation function", () => {
		const tests: CategorizedTest[] = [
			{
				testCase: createMockTestCase({ name: "t1", validation: "parse" }),
				outcome: "pass",
			},
			{
				testCase: createMockTestCase({ name: "t2", validation: "parse" }),
				outcome: "fail",
				error: "wrong",
			},
			{
				testCase: createMockTestCase({ name: "t3", validation: "build_hierarchy" }),
				outcome: "pass",
			},
			{
				testCase: createMockTestCase({ name: "t4", validation: "get_string" }),
				outcome: "skip",
				reason: "function:get_string not supported",
			},
		];

		const result = aggregateResults(tests);

		expect(result.functions.parse).toEqual(
			expect.objectContaining({
				passed: 1,
				failed: 1,
				skipped: 0,
				todo: 0,
				total: 2,
			}),
		);
		expect(result.functions.parse.passRate).toBeCloseTo(0.5);

		expect(result.functions.build_hierarchy).toEqual(
			expect.objectContaining({
				passed: 1,
				failed: 0,
				total: 1,
			}),
		);
		expect(result.functions.build_hierarchy.passRate).toBe(1);

		expect(result.functions.get_string).toEqual(
			expect.objectContaining({
				passed: 0,
				failed: 0,
				skipped: 1,
				total: 1,
			}),
		);
		expect(result.functions.get_string.passRate).toBeNull();
	});

	it("tallies behavior tags across tests", () => {
		const tests: CategorizedTest[] = [
			{
				testCase: createMockTestCase({
					name: "t1",
					behaviors: ["boolean_strict"],
				}),
				outcome: "pass",
			},
			{
				testCase: createMockTestCase({
					name: "t2",
					behaviors: ["boolean_strict"],
				}),
				outcome: "fail",
				error: "wrong",
			},
			{
				testCase: createMockTestCase({
					name: "t3",
					behaviors: ["tabs_as_content"],
				}),
				outcome: "skip",
				reason: "Behavior conflict: ...",
			},
		];

		const result = aggregateResults(tests);

		expect(result.behaviors.boolean_strict).toEqual(
			expect.objectContaining({
				passed: 1,
				failed: 1,
				skipped: 0,
				todo: 0,
				total: 2,
			}),
		);
		expect(result.behaviors.tabs_as_content).toEqual(
			expect.objectContaining({
				passed: 0,
				failed: 0,
				skipped: 1,
				todo: 0,
				total: 1,
			}),
		);
	});

	it("tallies feature tags across tests", () => {
		const tests: CategorizedTest[] = [
			{
				testCase: createMockTestCase({ name: "t1", features: ["comments", "unicode"] }),
				outcome: "pass",
			},
			{
				testCase: createMockTestCase({ name: "t2", features: ["comments"] }),
				outcome: "fail",
				error: "x",
			},
		];

		const result = aggregateResults(tests);

		expect(result.features.comments).toEqual(
			expect.objectContaining({ passed: 1, failed: 1, total: 2 }),
		);
		expect(result.features.unicode).toEqual(
			expect.objectContaining({ passed: 1, failed: 0, total: 1 }),
		);
	});

	it("tallies variant tags across tests", () => {
		const tests: CategorizedTest[] = [
			{
				testCase: createMockTestCase({ name: "t1", variants: ["reference_compliant"] }),
				outcome: "pass",
			},
			{
				testCase: createMockTestCase({
					name: "t2",
					variants: ["proposed_behavior"],
				}),
				outcome: "skip",
				reason: "Variant mismatch: ...",
			},
		];

		const result = aggregateResults(tests);

		expect(result.variants.reference_compliant).toEqual(
			expect.objectContaining({ passed: 1, skipped: 0, total: 1 }),
		);
		expect(result.variants.proposed_behavior).toEqual(
			expect.objectContaining({ passed: 0, skipped: 1, total: 1 }),
		);
	});

	it("builds test outcomes when includeTests is true", () => {
		const tests: CategorizedTest[] = [
			{ testCase: createMockTestCase({ name: "t1", validation: "parse" }), outcome: "pass" },
			{
				testCase: createMockTestCase({ name: "t2", validation: "parse" }),
				outcome: "skip",
				reason: "function:parse not supported",
			},
		];

		const result = aggregateResults(tests, { includeTests: true });

		expect(result.tests).toBeDefined();
		expect(result.tests).toHaveLength(2);
		expect(result.tests?.[0]).toEqual(
			expect.objectContaining({ name: "t1", validation: "parse", outcome: "pass" }),
		);
		expect(result.tests?.[1]).toEqual(
			expect.objectContaining({
				name: "t2",
				validation: "parse",
				outcome: "skip",
				reason: "function:parse not supported",
			}),
		);
	});

	it("omits test outcomes when includeTests is false or omitted", () => {
		const tests: CategorizedTest[] = [
			{ testCase: createMockTestCase({ name: "t1" }), outcome: "pass" },
		];

		const result = aggregateResults(tests);
		expect(result.tests).toBeUndefined();
	});

	it("computes metrics from the aggregated summary", () => {
		const tests: CategorizedTest[] = [
			{ testCase: createMockTestCase({ name: "t1" }), outcome: "pass" },
			{ testCase: createMockTestCase({ name: "t2" }), outcome: "pass" },
			{ testCase: createMockTestCase({ name: "t3" }), outcome: "fail", error: "x" },
			{
				testCase: createMockTestCase({ name: "t4" }),
				outcome: "skip",
				reason: "function:x not supported",
			},
		];

		const result = aggregateResults(tests);

		// 2 passed, 1 failed, 1 skipped
		expect(result.metrics.passRate).toBeCloseTo(2 / 3);
		expect(result.metrics.coverage).toBeCloseTo(3 / 4); // (4-1) / 4
		expect(result.metrics.completeness).toBeCloseTo(3 / 3); // (2+1) / (4-1)
		expect(result.metrics.overallScore).toBeCloseTo(2 / 4);
	});

	it("handles an empty test array", () => {
		const result = aggregateResults([]);

		expect(result.summary.totalTests).toBe(0);
		expect(result.summary.passed).toBe(0);
		expect(result.metrics.passRate).toBeNull();
		expect(result.metrics.coverage).toBeNull();
		expect(Object.keys(result.functions)).toHaveLength(0);
	});

	it("includes error message in test outcomes for failures", () => {
		const tests: CategorizedTest[] = [
			{
				testCase: createMockTestCase({ name: "t1", validation: "parse" }),
				outcome: "fail",
				error: "Expected 3 entries but got 2",
			},
		];

		const result = aggregateResults(tests, { includeTests: true });

		expect(result.tests?.[0]).toEqual(
			expect.objectContaining({
				outcome: "fail",
				error: "Expected 3 entries but got 2",
			}),
		);
	});
});

// ---------------------------------------------------------------------------
// generateTestResults (integration)
// ---------------------------------------------------------------------------

describe("generateTestResults", () => {
	// Minimal parse implementation for integration testing
	function stubParse(input: string): Array<{ key: string; value: string }> {
		const entries: Array<{ key: string; value: string }> = [];
		for (const line of input.split("\n")) {
			const eqIdx = line.indexOf("=");
			if (eqIdx >= 0) {
				entries.push({
					key: line.slice(0, eqIdx).trim(),
					value: line.slice(eqIdx + 1).trim(),
				});
			}
		}
		return entries;
	}

	it("produces valid CCLTestResults from a minimal config", async () => {
		const results = await generateTestResults({
			config: {
				name: "test-stub",
				version: "0.0.1",
				testDataPath: TEST_DATA_PATH,
				functions: {
					parse: stubParse,
				},
				behaviors: [
					"boolean_lenient",
					"crlf_normalize_to_lf",
					"tabs_as_content",
					"delimiter_first_equals",
					"list_coercion_disabled",
				],
				variant: "proposed_behavior",
			},
			language: "typescript",
		});

		// Format version
		expect(results.formatVersion).toBe("1.0.0");

		// Implementation info
		expect(results.implementation.name).toBe("test-stub");
		expect(results.implementation.version).toBe("0.0.1");
		expect(results.implementation.language).toBe("typescript");
		expect(results.implementation.implementedFunctions).toContain("parse");

		// Summary invariant: passed + failed + skipped + todo = totalTests
		const { summary } = results;
		expect(summary.passed + summary.failed + summary.skipped + summary.todo).toBe(
			summary.totalTests,
		);

		// Should have some tests (the test suite is non-empty)
		expect(summary.totalTests).toBeGreaterThan(0);

		// Since we only implement parse, most tests should be skipped
		expect(summary.skipped).toBeGreaterThan(0);

		// Should have a parse function entry
		expect(results.functions.parse).toBeDefined();
		expect(results.functions.parse.total).toBeGreaterThan(0);

		// Metrics should be computed
		expect(results.metrics).toBeDefined();
		if (summary.passed + summary.failed > 0) {
			expect(results.metrics.passRate).toBeGreaterThanOrEqual(0);
			expect(results.metrics.passRate).toBeLessThanOrEqual(1);
		}
	});

	it("respects includeTests option", async () => {
		const results = await generateTestResults({
			config: {
				name: "test-stub",
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
			},
			language: "typescript",
			includeTests: true,
		});

		expect(results.tests).toBeDefined();
		expect(results.tests?.length).toBe(results.summary.totalTests);

		// Each test should have a name and outcome
		for (const t of results.tests ?? []) {
			expect(t.name).toBeTruthy();
			expect(["pass", "fail", "skip", "todo"]).toContain(t.outcome);
		}
	});

	it("populates testSuite with totalTests", async () => {
		const results = await generateTestResults({
			config: {
				name: "test-stub",
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
			},
			language: "typescript",
		});

		expect(results.testSuite.totalTests).toBe(results.summary.totalTests);
	});

	it("produces a valid generatedAt timestamp", async () => {
		const before = new Date().toISOString();
		const results = await generateTestResults({
			config: {
				name: "test-stub",
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
			},
			language: "typescript",
		});
		const after = new Date().toISOString();

		// Should be valid ISO 8601
		expect(() => new Date(results.generatedAt)).not.toThrow();
		expect(results.generatedAt >= before).toBe(true);
		expect(results.generatedAt <= after).toBe(true);
	});

	it("per-function totals sum to totalTests", async () => {
		const results = await generateTestResults({
			config: {
				name: "test-stub",
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
			},
			language: "typescript",
		});

		const fnTotal = Object.values(results.functions).reduce((sum, fn) => sum + fn.total, 0);
		expect(fnTotal).toBe(results.summary.totalTests);
	});
});
