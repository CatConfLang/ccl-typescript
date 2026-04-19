import { describe, expect, it } from "vitest";
import { generateNutritionLabel } from "../../src/nutrition-label.js";
import type { CCLTestResults, TestOutcome } from "../../src/test-results.js";

function outcome(overrides: Partial<TestOutcome>): TestOutcome {
	return {
		name: "t",
		validation: "parse",
		behaviors: [],
		features: [],
		variants: [],
		outcome: "pass",
		...overrides,
	};
}

function buildResults(tests: TestOutcome[], overrides: Partial<CCLTestResults> = {}): CCLTestResults {
	return {
		$schema:
			"https://raw.githubusercontent.com/CatConfLang/ccl-test-data/main/schemas/test-results-format.json",
		generatedAt: "2026-04-18T00:00:00.000Z",
		implementation: {
			name: "ccl-ts",
			version: "0.1.0",
			language: "typescript",
			variant: "proposed_behavior",
			implementedFunctions: ["parse"],
		},
		testSuite: {
			version: "v1.2.3",
			totalTests: tests.length,
		},
		tests,
		...overrides,
	};
}

describe("generateNutritionLabel", () => {
	it("renders a header with implementation and suite metadata", () => {
		const md = generateNutritionLabel(buildResults([outcome({})]));
		expect(md).toContain("# CCL Test Results: ccl-ts 0.1.0");
		expect(md).toContain("**Language:** typescript");
		expect(md).toContain("**Variant:** proposed_behavior");
		expect(md).toContain("v1.2.3");
	});

	it("computes summary counts and percentages", () => {
		const tests = [
			outcome({ name: "a", outcome: "pass" }),
			outcome({ name: "b", outcome: "pass" }),
			outcome({ name: "c", outcome: "fail", error: "boom" }),
			outcome({ name: "d", outcome: "skip", reason: "function:parse not supported" }),
			outcome({ name: "e", outcome: "todo", reason: "not yet" }),
		];
		const md = generateNutritionLabel(buildResults(tests));
		expect(md).toContain("| Pass | 2 | 40.0% |");
		expect(md).toContain("| Fail | 1 | 20.0% |");
		expect(md).toContain("| Skip | 1 | 20.0% |");
		expect(md).toContain("| Todo | 1 | 20.0% |");
		expect(md).toContain("| **Total** | **5** | 100% |");
	});

	it("groups by validation and marks implemented status", () => {
		const tests = [
			outcome({ name: "a", validation: "parse", outcome: "pass" }),
			outcome({ name: "b", validation: "build_hierarchy", outcome: "skip", reason: "function:build_hierarchy not supported" }),
		];
		const md = generateNutritionLabel(buildResults(tests));
		expect(md).toMatch(/\| parse \| 1 \| 0 \| 0 \| 0 \| 1 \| yes \|/);
		expect(md).toMatch(/\| build_hierarchy \| 0 \| 0 \| 1 \| 0 \| 1 \| no \|/);
	});

	it("includes a skip-reason breakdown when there are skips", () => {
		const tests = [
			outcome({ name: "a", outcome: "skip", reason: "function:parse not supported" }),
			outcome({ name: "b", outcome: "skip", reason: "Explicitly skipped via skipTests" }),
			outcome({ name: "c", outcome: "skip", reason: "function:parse not supported" }),
		];
		const md = generateNutritionLabel(buildResults(tests));
		expect(md).toContain("## Skip Reasons");
		expect(md).toContain("| function | 2 |");
		expect(md).toContain("| explicit | 1 |");
	});

	it("omits skip section when there are no skips", () => {
		const md = generateNutritionLabel(buildResults([outcome({ outcome: "pass" })]));
		expect(md).not.toContain("## Skip Reasons");
	});

	it("lists failures with truncated errors", () => {
		const longError = "x".repeat(500);
		const tests = [
			outcome({ name: "fail-1", outcome: "fail", error: longError }),
			outcome({ name: "fail-2", outcome: "fail", error: "short" }),
		];
		const md = generateNutritionLabel(buildResults(tests), { maxErrorLength: 50 });
		expect(md).toContain("## Failures (2)");
		expect(md).toContain("`fail-1`");
		expect(md).toContain("`fail-2`");
		expect(md).toContain("…");
		expect(md).not.toContain(longError);
	});

	it("truncates long failure lists", () => {
		const tests = Array.from({ length: 30 }, (_, i) =>
			outcome({ name: `t${i}`, outcome: "fail", error: "e" }),
		);
		const md = generateNutritionLabel(buildResults(tests), { maxFailures: 5 });
		expect(md).toContain("## Failures (30)");
		expect(md).toContain("…and 25 more");
	});

	it("omits failures section when there are no failures", () => {
		const md = generateNutritionLabel(buildResults([outcome({ outcome: "pass" })]));
		expect(md).not.toContain("## Failures");
	});

	it("throws on missing or wrong $schema URL", () => {
		const missing = buildResults([outcome({})], { $schema: "" });
		expect(() => generateNutritionLabel(missing)).toThrow(/\$schema/);

		const wrong = buildResults([outcome({})], {
			$schema: "https://example.com/some-other-schema.json",
		});
		expect(() => generateNutritionLabel(wrong)).toThrow(/test-results-format/);
	});

	it("handles empty test array without dividing by zero", () => {
		const md = generateNutritionLabel(buildResults([]));
		expect(md).toContain("| **Total** | **0** | 100% |");
		expect(md).toContain("| Pass | 0 | 0% |");
	});
});
