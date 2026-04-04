/**
 * Example: Declarative CCL test suite using the vitest integration.
 *
 * This demonstrates the recommended approach for CCL implementers:
 * 1. Import defineCCLTests and wire up your functions
 * 2. Export the config for potential CLI tooling
 * 3. Tests are automatically generated with proper skip/todo handling
 */
import { describe, expect, test } from "vitest";
import { parse } from "../../src/ccl.js";
import type { CCLBehavior } from "../../src/capabilities.js";
import { loadConfigFileSync } from "../../src/config.js";
import {
	type CCLFunctions,
	createCCLTestCases,
	defineCCLTests,
	getCCLTestSuiteInfo,
} from "../../src/vitest.js";
import { CCL_CONFIG_PATH, STUB_PARSER_SKIP_TESTS, TEST_DATA_PATH, applyStubBehaviorOverrides } from "./test-config.js";

// Load behaviors from config file, then apply stub parser overrides
const fileConfig = loadConfigFileSync(CCL_CONFIG_PATH, {
	name: "ccl-test-runner-ts-example",
	version: "0.1.0",
});
const stubBehaviors: CCLBehavior[] = applyStubBehaviorOverrides(fileConfig.behaviors);

/**
 * Define CCL test configuration.
 *
 * This is the declarative approach - just wire up your functions
 * and the library handles test generation, skip/todo logic, etc.
 */
const cclConfig = defineCCLTests({
	name: "ccl-test-runner-ts-example",
	version: "0.1.0",

	testDataPath: TEST_DATA_PATH,

	// Load capabilities from ccl-config.yaml; functions declared there but not
	// wired up below will be marked as "todo" instead of "skip".
	configPath: CCL_CONFIG_PATH,

	// Override behaviors for the stub parser (e.g. CRLF normalization)
	behaviors: stubBehaviors,

	// Wire up only the functions you've implemented
	functions: {
		parse, // Using the built-in stub/example implementation
		// build_hierarchy: buildHierarchy,  // Uncomment as you implement
	} satisfies CCLFunctions,

	// Tests to skip - these require full CCL parser features not implemented in stub
	skipTests: STUB_PARSER_SKIP_TESTS,
});

describe("CCL (Declarative API)", async () => {
	// Get suite info for progress display
	const info = await getCCLTestSuiteInfo(cclConfig);

	// Log progress summary
	console.log(`\nCCL Test Suite: ${info.capabilities.name}`);
	console.log(
		`Functions: ${info.implementedFunctions.length}/${info.capabilities.functions.length} implemented`,
	);
	console.log(
		`Tests: ${info.runnableTests} runnable, ${info.skippedTests} skipped, ${info.todoTests} todo`,
	);

	// Create categorized test cases
	const { byFunction } = await createCCLTestCases(cclConfig);

	// Generate tests organized by validation function
	for (const [fn, testEntries] of byFunction) {
		describe(fn, () => {
			for (const { categorization, run } of testEntries) {
				const { testCase } = categorization;

				switch (categorization.type) {
					case "skip":
						// Function or feature not supported - skip with reason
						test(testCase.name, (ctx) => {
							ctx.skip(categorization.reason);
						});
						break;

					case "todo":
						// Function declared but not implemented - mark as todo
						test.todo(testCase.name);
						break;

					case "run":
						// All requirements met - run the test
						test(testCase.name, () => {
							const result = run();
							// Use custom CCL matcher for rich error messages
							expect(result).toPassCCLTest();
						});
						break;

					default:
						// Exhaustive check - should never reach here
						break;
				}
			}
		});
	}
});
