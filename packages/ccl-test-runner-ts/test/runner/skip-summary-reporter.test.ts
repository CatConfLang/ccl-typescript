import { describe, expect, it } from "vitest";
import {
	formatBehaviorDetail,
	formatVariantDetail,
	normalizeFunctionDetail,
} from "../../src/skip-summary-reporter.js";

describe("normalizeFunctionDetail", () => {
	it("strips ' not supported' suffix", () => {
		expect(normalizeFunctionDetail("parse not supported")).toBe("parse");
	});

	it("strips ' declared but not implemented' suffix", () => {
		expect(normalizeFunctionDetail("parse declared but not implemented")).toBe("parse");
	});

	it("strips '(required for X)' parenthetical", () => {
		expect(normalizeFunctionDetail("parse (required for round_trip) not supported")).toBe("parse");
	});

	it("strips '(required for X)' without trailing suffix", () => {
		expect(normalizeFunctionDetail("parse (required for round_trip)")).toBe("parse");
	});

	it("strips '(required for X) declared but not implemented' combined", () => {
		expect(
			normalizeFunctionDetail("parse (required for round_trip) declared but not implemented"),
		).toBe("parse");
	});

	it("leaves multi-function comma-separated string intact", () => {
		expect(normalizeFunctionDetail("parse, build_hierarchy")).toBe("parse, build_hierarchy");
	});

	it("leaves plain function name unchanged", () => {
		expect(normalizeFunctionDetail("build_hierarchy")).toBe("build_hierarchy");
	});
});

describe("formatBehaviorDetail", () => {
	it("shortens 'test requires X, implementation uses Y' format", () => {
		expect(
			formatBehaviorDetail("test requires boolean_strict, implementation uses boolean_lenient"),
		).toBe("boolean_strict (impl: boolean_lenient)");
	});

	it("shortens 'test conflicts with X' format", () => {
		expect(formatBehaviorDetail("test conflicts with boolean_strict")).toBe(
			"boolean_strict (excluded)",
		);
	});

	it("returns raw string for plain behavior name", () => {
		expect(formatBehaviorDetail("boolean_strict")).toBe("boolean_strict");
	});
});

describe("formatVariantDetail", () => {
	it("shortens 'test requires X, implementation uses Y' format", () => {
		expect(
			formatVariantDetail(
				"test requires proposed_behavior or reference_compliant, implementation uses proposed_behavior",
			),
		).toBe("requires proposed_behavior or reference_compliant");
	});

	it("shortens 'test conflicts with X' format", () => {
		expect(formatVariantDetail("test conflicts with proposed_behavior")).toBe(
			"proposed_behavior (excluded)",
		);
	});

	it("returns raw string for plain variant name", () => {
		expect(formatVariantDetail("proposed_behavior")).toBe("proposed_behavior");
	});
});
