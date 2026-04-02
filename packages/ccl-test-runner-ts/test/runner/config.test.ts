import { join } from "pathe";
import { describe, expect, test } from "vitest";
import {
	type CCLConfigFile,
	configFileToCapabilities,
	loadConfigFile,
	loadConfigFileSync,
} from "../../src/config.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

describe("configFileToCapabilities", () => {
	test("converts minimal config (functions only)", () => {
		const config: CCLConfigFile = {
			functions: ["parse", "build_hierarchy"],
		};

		const capabilities = configFileToCapabilities(config);

		expect(capabilities.functions).toEqual(["parse", "build_hierarchy"]);
		expect(capabilities.features).toEqual([]);
		expect(capabilities.behaviors).toEqual([]);
		expect(capabilities.variant).toBe("proposed_behavior");
		expect(capabilities.skipTests).toBeUndefined();
		expect(capabilities.name).toBe("ccl-implementation");
		expect(capabilities.version).toBe("0.0.0");
	});

	test("converts full config with all fields", () => {
		const config: CCLConfigFile = {
			functions: ["parse", "get_string"],
			features: ["comments", "unicode"],
			behaviors: ["boolean_lenient", "crlf_normalize_to_lf"],
			variants: ["reference_compliant"],
			skip_tests: ["some_test"],
		};

		const capabilities = configFileToCapabilities(config);

		expect(capabilities.functions).toEqual(["parse", "get_string"]);
		expect(capabilities.features).toEqual(["comments", "unicode"]);
		expect(capabilities.behaviors).toEqual(["boolean_lenient", "crlf_normalize_to_lf"]);
		expect(capabilities.variant).toBe("reference_compliant");
		expect(capabilities.skipTests).toEqual(["some_test"]);
	});

	test("applies name and version overrides", () => {
		const config: CCLConfigFile = {
			functions: ["parse"],
		};

		const capabilities = configFileToCapabilities(config, {
			name: "my-impl",
			version: "1.2.3",
		});

		expect(capabilities.name).toBe("my-impl");
		expect(capabilities.version).toBe("1.2.3");
	});

	test("defaults variant to proposed_behavior when variants is empty", () => {
		const config: CCLConfigFile = {
			functions: ["parse"],
			variants: [],
		};

		const capabilities = configFileToCapabilities(config);

		expect(capabilities.variant).toBe("proposed_behavior");
	});
});

describe("loadConfigFile", () => {
	test("loads and parses a YAML config file", async () => {
		const configPath = join(FIXTURES_DIR, "test-ccl-config.yaml");
		const capabilities = await loadConfigFile(configPath, { name: "test-impl" });

		expect(capabilities.name).toBe("test-impl");
		expect(capabilities.functions).toEqual(["parse", "build_hierarchy", "get_string"]);
		expect(capabilities.features).toEqual(["comments"]);
		expect(capabilities.behaviors).toEqual(["boolean_lenient", "crlf_normalize_to_lf"]);
		expect(capabilities.variant).toBe("proposed_behavior");
	});
});

describe("loadConfigFileSync", () => {
	test("loads and parses a YAML config file synchronously", () => {
		const configPath = join(FIXTURES_DIR, "test-ccl-config.yaml");
		const capabilities = loadConfigFileSync(configPath, { name: "test-impl" });

		expect(capabilities.name).toBe("test-impl");
		expect(capabilities.functions).toEqual(["parse", "build_hierarchy", "get_string"]);
		expect(capabilities.features).toEqual(["comments"]);
		expect(capabilities.behaviors).toEqual(["boolean_lenient", "crlf_normalize_to_lf"]);
		expect(capabilities.variant).toBe("proposed_behavior");
	});
});
