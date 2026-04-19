/**
 * CCL Test Results JSON format types and generation.
 *
 * Defines a structured JSON output format for CCL test results that can be
 * produced by any test runner and consumed to build scorecards or
 * "nutrition facts" labels for implementations. Consumers derive summaries,
 * metrics, and per-tag breakdowns from the raw test outcomes.
 */

import type { CCLTestConfig, CCLTestResult } from "./vitest.js";

// ---------------------------------------------------------------------------
// Result format types
// ---------------------------------------------------------------------------

/**
 * Top-level test results document.
 * Consumers derive summaries, metrics, and per-tag breakdowns from `tests`.
 */
export interface CCLTestResults {
	/**
	 * URL to the JSON schema this document conforms to. Declares which version
	 * of the test-results format this document targets — consumers pin the URL
	 * to a ccl-test-data release tag (e.g. `.../vX.Y.Z/schemas/test-results-format.json`).
	 */
	$schema: string;
	/** ISO 8601 timestamp */
	generatedAt: string;
	/** Identity and capability declaration of the implementation under test */
	implementation: ImplementationInfo;
	/** Version of the ccl-test-data test suite used */
	testSuite: TestSuiteInfo;
	/** Individual test outcomes with full tag metadata for consumer-side aggregation */
	tests: TestOutcome[];
}

/**
 * Implementation identity and capability declaration.
 */
export interface ImplementationInfo {
	name: string;
	version: string;
	language: string;
	variant: string;
	/**
	 * Functions with actual implementations.
	 * Cannot be derived from test outcomes alone — a function may be implemented
	 * but have all its tests skipped.
	 */
	implementedFunctions: string[];
}

/**
 * Information about the test suite version used.
 */
export interface TestSuiteInfo {
	version?: string;
	/** Total number of tests in the suite. Should equal tests.length. */
	totalTests: number;
}

/**
 * Individual test outcome with full tag metadata.
 * Tags are copied from the test case so consumers can aggregate by any dimension.
 */
export interface TestOutcome {
	name: string;
	validation: string;
	behaviors: string[];
	features: string[];
	variants: string[];
	outcome: "pass" | "fail" | "skip" | "todo";
	/** Raw skip/todo reason — consumers categorize as needed */
	reason?: string;
	error?: string;
	durationMs?: number;
}

// ---------------------------------------------------------------------------
// Consumer utilities
// ---------------------------------------------------------------------------

export type SkipReasonCategory =
	| "function"
	| "behavior"
	| "variant"
	| "conflict"
	| "explicit"
	| "other";

/**
 * Categorize a raw skip reason string into a display bucket.
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
	/**
	 * URL stamped into the document's `$schema` field. Pin this to a release
	 * tag of ccl-test-data (e.g. `.../vX.Y.Z/schemas/test-results-format.json`)
	 * so consumers can resolve the exact format version. Defaults to `main`.
	 */
	schemaUrl?: string;
}

const DEFAULT_SCHEMA_URL =
	"https://raw.githubusercontent.com/CatConfLang/ccl-test-data/main/schemas/test-results-format.json";

/**
 * Generate a complete CCLTestResults document from a CCL test config.
 *
 * Runs the full pipeline:
 * 1. Builds capabilities from the config
 * 2. Loads and categorizes all tests
 * 3. Runs each "run" test and records pass/fail
 * 4. Returns raw outcomes with full tag metadata for consumer-side aggregation
 */
export async function generateTestResults(
	options: GenerateTestResultsOptions,
): Promise<CCLTestResults> {
	const { config, language, schemaUrl = DEFAULT_SCHEMA_URL } = options;

	// Dynamically import to avoid circular dependencies — vitest.ts is the
	// main module and test-results.ts is a utility module.
	const { createCCLTestCases, getCCLTestSuiteInfo } = await import("./vitest.js");

	const [suiteInfo, { tests }] = await Promise.all([
		getCCLTestSuiteInfo(config),
		createCCLTestCases(config),
	]);

	const testOutcomes: TestOutcome[] = [];

	for (const { categorization, run } of tests) {
		const { testCase } = categorization;
		const tags = {
			behaviors: [...testCase.behaviors],
			features: [...testCase.features],
			variants: [...testCase.variants],
		};

		switch (categorization.type) {
			case "skip":
				testOutcomes.push({
					name: testCase.name,
					validation: testCase.validation,
					...tags,
					outcome: "skip",
					reason: categorization.reason,
				});
				break;

			case "todo":
				testOutcomes.push({
					name: testCase.name,
					validation: testCase.validation,
					...tags,
					outcome: "todo",
					reason: categorization.reason,
				});
				break;

			case "run": {
				let result: CCLTestResult;
				try {
					result = run();
				} catch (e) {
					testOutcomes.push({
						name: testCase.name,
						validation: testCase.validation,
						...tags,
						outcome: "fail",
						error: e instanceof Error ? e.message : String(e),
					});
					break;
				}

				const entry: TestOutcome = {
					name: testCase.name,
					validation: testCase.validation,
					...tags,
					outcome: result.passed ? "pass" : "fail",
				};
				if (result.error) entry.error = result.error;
				testOutcomes.push(entry);
				break;
			}
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

	return {
		$schema: schemaUrl,
		generatedAt: new Date().toISOString(),
		implementation: {
			name: capabilities.name,
			version: capabilities.version,
			language,
			variant: capabilities.variant,
			implementedFunctions: [...suiteInfo.implementedFunctions],
		},
		testSuite: {
			totalTests: testOutcomes.length,
			...(testSuiteVersion ? { version: testSuiteVersion } : {}),
		},
		tests: testOutcomes,
	};
}
