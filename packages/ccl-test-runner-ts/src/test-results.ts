/**
 * CCL Test Results JSON format types and aggregation functions.
 *
 * Defines a structured JSON output format for CCL test results that can be
 * produced by any test runner and consumed to build scorecards or
 * "nutrition facts" labels for implementations.
 */

import type { TestCase } from "./schema-validation.js";
import type { CCLTestConfig, CCLTestResult } from "./vitest.js";

// ---------------------------------------------------------------------------
// Result format types
// ---------------------------------------------------------------------------

/**
 * Top-level test results document.
 * Self-contained: a consumer can build a full scorecard from this alone.
 */
export interface CCLTestResults {
	/** URL to JSON schema for validation */
	$schema?: string;
	/** Format version for forward compatibility */
	formatVersion: "1.0.0";
	/** ISO 8601 timestamp */
	generatedAt: string;

	/** Identity and configuration of the implementation under test */
	implementation: ImplementationInfo;
	/** Version of the ccl-test-data test suite used */
	testSuite: TestSuiteInfo;
	/** Aggregate counts across all tests */
	summary: TestSummary;
	/** Computed metrics ready for scorecard display */
	metrics: ScorecardMetrics;
	/** Per-function breakdown of results */
	functions: Record<string, FunctionResults>;
	/** Per-behavior breakdown */
	behaviors: Record<string, TagBreakdown>;
	/** Per-feature breakdown */
	features: Record<string, TagBreakdown>;
	/** Per-variant breakdown */
	variants: Record<string, TagBreakdown>;

	/** Individual test outcomes — optional, omit for compact reports */
	tests?: TestOutcome[];
}

/**
 * Implementation identity and declared capabilities.
 */
export interface ImplementationInfo {
	name: string;
	version: string;
	language: string;
	variant: string;
	declaredFunctions: string[];
	implementedFunctions: string[];
	todoFunctions: string[];
	behaviors: string[];
	optionalBehaviors: string[];
	features: string[];
	skipTests?: string[];
}

/**
 * Information about the test suite version used.
 */
export interface TestSuiteInfo {
	version?: string;
	totalTests: number;
}

/**
 * Aggregate test counts.
 * Invariant: passed + failed + skipped + todo = totalTests
 */
export interface TestSummary {
	totalTests: number;
	passed: number;
	failed: number;
	skipped: number;
	todo: number;
	skipReasons: Record<string, number>;
}

/**
 * Pre-computed metrics for scorecard display.
 * All ratios are in [0, 1]. null when denominator is 0.
 */
export interface ScorecardMetrics {
	/** passed / (passed + failed) */
	passRate: number | null;
	/** (total - skipped) / total */
	coverage: number | null;
	/** (passed + failed) / (total - skipped) */
	completeness: number | null;
	/** passed / total */
	overallScore: number | null;
}

/**
 * Per-function results breakdown.
 */
export interface FunctionResults {
	status: "implemented" | "todo" | "unsupported";
	passed: number;
	failed: number;
	skipped: number;
	todo: number;
	total: number;
	passRate: number | null;
}

/**
 * Breakdown for a behavior, feature, or variant tag.
 */
export interface TagBreakdown {
	passed: number;
	failed: number;
	skipped: number;
	todo: number;
	total: number;
}

/**
 * Individual test outcome.
 */
export interface TestOutcome {
	name: string;
	validation: string;
	outcome: "pass" | "fail" | "skip" | "todo";
	reason?: string;
	error?: string;
	durationMs?: number;
}

// ---------------------------------------------------------------------------
// Skip reason categories
// ---------------------------------------------------------------------------

export type SkipReasonCategory =
	| "function"
	| "behavior"
	| "variant"
	| "conflict"
	| "explicit"
	| "other";

/**
 * Categorize a skip reason string into a bucket.
 *
 * The test runner produces these formats:
 * - "function:parse not supported" → function
 * - "Missing required functions: parse, build_hierarchy" → function
 * - "Behavior conflict: test requires X, implementation uses Y" → behavior
 * - "Missing behavior: path_traversal" → behavior
 * - "Variant mismatch: test requires X, implementation uses Y" → variant
 * - "Function conflict: test conflicts with compose" → conflict
 * - "Behavior conflict: test conflicts with X" → conflict
 * - "Variant conflict: test conflicts with X" → conflict
 * - "Explicitly skipped via skipTests" → explicit
 *
 * The key distinction: "test conflicts with" comes from the test's `conflicts`
 * field (a test excluding certain implementations), while "test requires"
 * comes from capability mismatches (implementation doesn't support something).
 */
export function categorizeSkipReason(reason: string): SkipReasonCategory {
	if (reason.includes("Explicitly skipped")) {
		return "explicit";
	}

	// "test conflicts with" comes from the conflicts field on test cases —
	// these are explicit exclusions, not capability mismatches.
	if (reason.includes("test conflicts with")) {
		return "conflict";
	}

	const lower = reason.toLowerCase();

	// Check prefix format "category:detail"
	const colonIndex = reason.indexOf(":");
	if (colonIndex > 0) {
		const prefix = reason.slice(0, colonIndex).toLowerCase().trim();
		if (prefix === "function" || prefix.includes("function")) return "function";
		if (prefix === "behavior" || prefix.includes("behavior")) return "behavior";
		if (prefix === "variant" || prefix.includes("variant")) return "variant";
		if (prefix === "conflict" || prefix.includes("conflict")) return "conflict";
	}

	// Check content for keywords
	if (lower.includes("function")) return "function";
	if (lower.includes("behavior")) return "behavior";
	if (lower.includes("variant")) return "variant";
	if (lower.includes("conflict")) return "conflict";

	return "other";
}

// ---------------------------------------------------------------------------
// Metric computation
// ---------------------------------------------------------------------------

/**
 * Compute scorecard metrics from a test summary.
 * Returns null for any metric where the denominator is 0.
 */
export function computeMetrics(summary: TestSummary): ScorecardMetrics {
	const { totalTests, passed, failed, skipped } = summary;
	const ran = passed + failed;
	const applicable = totalTests - skipped;

	return {
		passRate: ran > 0 ? passed / ran : null,
		coverage: totalTests > 0 ? applicable / totalTests : null,
		completeness: applicable > 0 ? ran / applicable : null,
		overallScore: totalTests > 0 ? passed / totalTests : null,
	};
}

// ---------------------------------------------------------------------------
// Result aggregation
// ---------------------------------------------------------------------------

/**
 * A categorized test result ready for aggregation.
 */
export interface CategorizedTest {
	testCase: TestCase;
	outcome: "pass" | "fail" | "skip" | "todo";
	reason?: string | undefined;
	error?: string | undefined;
}

/**
 * Options for aggregateResults.
 */
export interface AggregateOptions {
	/** Include individual test outcomes in the output */
	includeTests?: boolean;
}

/**
 * Aggregated results (everything except implementation info and test suite metadata).
 */
export interface AggregatedResults {
	summary: TestSummary;
	metrics: ScorecardMetrics;
	functions: Record<string, FunctionResults>;
	behaviors: Record<string, TagBreakdown>;
	features: Record<string, TagBreakdown>;
	variants: Record<string, TagBreakdown>;
	tests?: TestOutcome[];
}

function emptyTagBreakdown(): TagBreakdown {
	return { passed: 0, failed: 0, skipped: 0, todo: 0, total: 0 };
}

function emptyFunctionResults(): FunctionResults {
	return {
		status: "unsupported",
		passed: 0,
		failed: 0,
		skipped: 0,
		todo: 0,
		total: 0,
		passRate: null,
	};
}

function tallyOutcome(
	bucket: { passed: number; failed: number; skipped: number; todo: number; total: number },
	outcome: "pass" | "fail" | "skip" | "todo",
): void {
	bucket.total++;
	switch (outcome) {
		case "pass":
			bucket.passed++;
			break;
		case "fail":
			bucket.failed++;
			break;
		case "skip":
			bucket.skipped++;
			break;
		case "todo":
			bucket.todo++;
			break;
	}
}

/**
 * Aggregate categorized tests into the results format.
 * This is a pure function operating on pre-categorized test data.
 */
export function aggregateResults(
	tests: CategorizedTest[],
	options: AggregateOptions = {},
): AggregatedResults {
	const summary: TestSummary = {
		totalTests: tests.length,
		passed: 0,
		failed: 0,
		skipped: 0,
		todo: 0,
		skipReasons: {},
	};

	const functions: Record<string, FunctionResults> = {};
	const behaviors: Record<string, TagBreakdown> = {};
	const features: Record<string, TagBreakdown> = {};
	const variants: Record<string, TagBreakdown> = {};
	const testOutcomes: TestOutcome[] | undefined = options.includeTests ? [] : undefined;

	for (const { testCase, outcome, reason, error } of tests) {
		// Summary counts
		switch (outcome) {
			case "pass":
				summary.passed++;
				break;
			case "fail":
				summary.failed++;
				break;
			case "skip":
				summary.skipped++;
				break;
			case "todo":
				summary.todo++;
				break;
		}

		// Skip reason categorization
		if (outcome === "skip" && reason) {
			const category = categorizeSkipReason(reason);
			summary.skipReasons[category] = (summary.skipReasons[category] ?? 0) + 1;
		}

		// Per-function breakdown
		const fn = testCase.validation;
		if (functions[fn] === undefined) {
			functions[fn] = emptyFunctionResults();
		}
		tallyOutcome(functions[fn], outcome);

		// Per-behavior breakdown
		for (const behavior of testCase.behaviors) {
			if (behaviors[behavior] === undefined) {
				behaviors[behavior] = emptyTagBreakdown();
			}
			tallyOutcome(behaviors[behavior], outcome);
		}

		// Per-feature breakdown
		for (const feature of testCase.features) {
			if (features[feature] === undefined) {
				features[feature] = emptyTagBreakdown();
			}
			tallyOutcome(features[feature], outcome);
		}

		// Per-variant breakdown
		for (const variant of testCase.variants) {
			if (variants[variant] === undefined) {
				variants[variant] = emptyTagBreakdown();
			}
			tallyOutcome(variants[variant], outcome);
		}

		// Individual test outcome
		if (testOutcomes) {
			const entry: TestOutcome = {
				name: testCase.name,
				validation: testCase.validation,
				outcome,
			};
			if (reason) entry.reason = reason;
			if (error) entry.error = error;
			testOutcomes.push(entry);
		}
	}

	// Compute per-function passRate
	for (const fnResult of Object.values(functions)) {
		const ran = fnResult.passed + fnResult.failed;
		fnResult.passRate = ran > 0 ? fnResult.passed / ran : null;
	}

	const metrics = computeMetrics(summary);

	const result: AggregatedResults = {
		summary,
		metrics,
		functions,
		behaviors,
		features,
		variants,
	};

	if (testOutcomes) {
		result.tests = testOutcomes;
	}

	return result;
}

// ---------------------------------------------------------------------------
// generateTestResults — full pipeline
// ---------------------------------------------------------------------------

/**
 * Options for generateTestResults.
 */
export interface GenerateTestResultsOptions {
	/** The CCL test config (same as passed to defineCCLTests) */
	config: CCLTestConfig;
	/** Implementation language (e.g., "typescript", "go") */
	language: string;
	/** Include individual test outcomes in output */
	includeTests?: boolean;
}

/**
 * Generate a complete CCLTestResults document from a CCL test config.
 *
 * This runs the full pipeline:
 * 1. Builds capabilities from the config
 * 2. Loads and categorizes all tests
 * 3. Runs each "run" test and records pass/fail
 * 4. Aggregates everything into the results format
 */
export async function generateTestResults(
	options: GenerateTestResultsOptions,
): Promise<CCLTestResults> {
	const { config, language, includeTests = false } = options;

	// Dynamically import to avoid circular dependencies — vitest.ts is the
	// main module and test-results.ts is a utility module.
	const { createCCLTestCases, getCCLTestSuiteInfo } = await import("./vitest.js");

	const [suiteInfo, { tests }] = await Promise.all([
		getCCLTestSuiteInfo(config),
		createCCLTestCases(config),
	]);

	// Run tests and categorize outcomes
	const categorizedTests: CategorizedTest[] = [];

	for (const { categorization, run } of tests) {
		const { testCase } = categorization;

		switch (categorization.type) {
			case "skip":
				categorizedTests.push({
					testCase,
					outcome: "skip",
					reason: categorization.reason,
				});
				break;

			case "todo":
				categorizedTests.push({
					testCase,
					outcome: "todo",
					reason: categorization.reason,
				});
				break;

			case "run": {
				let result: CCLTestResult;
				try {
					result = run();
				} catch (e) {
					categorizedTests.push({
						testCase,
						outcome: "fail",
						error: e instanceof Error ? e.message : String(e),
					});
					break;
				}

				categorizedTests.push({
					testCase,
					outcome: result.passed ? "pass" : "fail",
					error: result.error,
				});
				break;
			}
		}
	}

	// Aggregate
	const aggregated = aggregateResults(categorizedTests, { includeTests });

	// Determine function statuses from suite info
	const implementedSet = new Set(suiteInfo.implementedFunctions);
	const declaredSet = new Set(suiteInfo.capabilities.functions);

	for (const [fn, fnResult] of Object.entries(aggregated.functions)) {
		if (implementedSet.has(fn as never)) {
			fnResult.status = "implemented";
		} else if (declaredSet.has(fn as never)) {
			fnResult.status = "todo";
		} else {
			fnResult.status = "unsupported";
		}
	}

	// Read test suite version if available
	let testSuiteVersion: string | undefined;
	try {
		const { readFile } = await import("node:fs/promises");
		const { join } = await import("pathe");
		const versionContent = await readFile(join(config.testDataPath, ".version"), "utf-8");
		testSuiteVersion = versionContent.trim();
	} catch {
		// .version file not found — that's fine
	}

	const { capabilities } = suiteInfo;

	const results: CCLTestResults = {
		formatVersion: "1.0.0",
		generatedAt: new Date().toISOString(),

		implementation: {
			name: capabilities.name,
			version: capabilities.version,
			language,
			variant: capabilities.variant,
			declaredFunctions: [...capabilities.functions],
			implementedFunctions: [...suiteInfo.implementedFunctions],
			todoFunctions: [...suiteInfo.declaredButNotImplemented],
			behaviors: [...capabilities.behaviors],
			optionalBehaviors: [...(capabilities.optionalBehaviors ?? [])],
			features: [...capabilities.features],
			...(capabilities.skipTests?.length ? { skipTests: [...capabilities.skipTests] } : {}),
		},

		testSuite: {
			totalTests: aggregated.summary.totalTests,
			...(testSuiteVersion ? { version: testSuiteVersion } : {}),
		},

		summary: aggregated.summary,
		metrics: aggregated.metrics,
		functions: aggregated.functions,
		behaviors: aggregated.behaviors,
		features: aggregated.features,
		variants: aggregated.variants,

		...(aggregated.tests ? { tests: aggregated.tests } : {}),
	};

	return results;
}
