/**
 * Shared test configuration for ccl-test-runner-ts.
 *
 * This file contains shared configuration for the test suite including
 * the path to test data and the list of tests to skip. This is internal
 * to the test suite and not exported to consumers of the package.
 */

import { createRequire } from "node:module";
import { dirname, join, resolve } from "pathe";
import type { CCLBehavior } from "../../src/capabilities.js";
import { loadConfigFileSync } from "../../src/config.js";

const require = createRequire(import.meta.url);

/**
 * Resolves the path to the ccl-test-data package's data directory.
 * Uses require.resolve to find the workspace package.
 */
function resolveTestDataPath(): string {
	// Resolve the package.json of ccl-test-data, then get the data directory
	const packageJsonPath = require.resolve("@tylerbu/ccl-test-data/package.json");
	return join(dirname(packageJsonPath), "data");
}

/**
 * Path to the shared test data directory from @tylerbu/ccl-test-data package.
 * All test files should import this constant instead of hardcoding the path.
 */
export const TEST_DATA_PATH = resolveTestDataPath();

/**
 * Path to the ccl-config.yaml at the monorepo root.
 * Declares the full set of capabilities for the TypeScript CCL implementation.
 */
export const CCL_CONFIG_PATH = resolve(import.meta.dirname, "../../../../ccl-config.yaml");

/**
 * Tests to skip - these require full CCL parser features not implemented in the stub.
 *
 * The stub parser is intentionally minimal and doesn't handle:
 * - Multiline key handling (newlines before =)
 * - Nested list parsing
 * - Complex whitespace/tab handling edge cases
 * - Round-trip normalization
 */
export const STUB_PARSER_SKIP_TESTS: string[] = [
	// Multiline key handling (newlines before =)
	"key_with_newline_before_equals_parse",
	"complex_multi_newline_whitespace_parse",
	// Nested list parsing
	"deeply_nested_list_parse",
	// Round-trip normalization
	"round_trip_whitespace_normalization_parse",
];

/**
 * Behavior overrides for the stub parser.
 *
 * The ccl-config.yaml declares behaviors for the full ccl-ts implementation,
 * but the stub parser has different capabilities:
 * - Uses line.trim() which strips \r, so it normalizes CRLF rather than preserving it
 */
export const STUB_PARSER_BEHAVIOR_OVERRIDES: Record<string, string> = {
	crlf_preserve_literal: "crlf_normalize_to_lf",
};

/**
 * Apply stub parser behavior overrides to a behaviors array.
 */
export function applyStubBehaviorOverrides(behaviors: CCLBehavior[]): CCLBehavior[] {
	return behaviors.map(
		(b) => (STUB_PARSER_BEHAVIOR_OVERRIDES[b] as CCLBehavior) ?? b,
	);
}

/**
 * Load capabilities from ccl-config.yaml with stub parser overrides applied.
 */
export function loadStubCapabilities() {
	const loaded = loadConfigFileSync(CCL_CONFIG_PATH, {
		name: "ccl-test-runner-ts",
		version: "0.1.0",
	});
	return {
		...loaded,
		behaviors: applyStubBehaviorOverrides(loaded.behaviors),
	};
}
