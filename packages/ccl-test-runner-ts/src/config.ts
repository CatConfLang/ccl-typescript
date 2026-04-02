/**
 * Load CCL implementation capabilities from a ccl-config.yaml file.
 *
 * This module reads the standardized YAML configuration format defined by
 * ccl-config-schema.json in ccl-test-data, enabling cross-implementation
 * capability comparison and schema validation.
 */

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type {
	CCLBehavior,
	CCLFeature,
	CCLFunction,
	CCLVariant,
	ImplementationCapabilities,
} from "./capabilities.js";

/**
 * Raw shape of a ccl-config.yaml file.
 * Matches the ccl-config-schema.json from ccl-test-data.
 */
export interface CCLConfigFile {
	functions: string[];
	features?: string[];
	behaviors?: string[];
	variants?: string[];
	skip_tests?: string[];
}

/**
 * Load and parse a ccl-config.yaml file into ImplementationCapabilities.
 *
 * @param configPath - Path to the ccl-config.yaml file
 * @param overrides - Optional overrides for name/version (not in the YAML schema)
 * @returns Parsed implementation capabilities
 */
export async function loadConfigFile(
	configPath: string,
	overrides?: { name?: string; version?: string },
): Promise<ImplementationCapabilities> {
	const content = await readFile(configPath, "utf-8");
	const config = parseYaml(content) as CCLConfigFile;
	return configFileToCapabilities(config, overrides);
}

/**
 * Convert a parsed CCL config file to ImplementationCapabilities.
 */
/**
 * Synchronously load and parse a ccl-config.yaml file into ImplementationCapabilities.
 *
 * @param configPath - Path to the ccl-config.yaml file
 * @param overrides - Optional overrides for name/version (not in the YAML schema)
 * @returns Parsed implementation capabilities
 */
export function loadConfigFileSync(
	configPath: string,
	overrides?: { name?: string; version?: string },
): ImplementationCapabilities {
	const content = readFileSync(configPath, "utf-8");
	const config = parseYaml(content) as CCLConfigFile;
	return configFileToCapabilities(config, overrides);
}

/**
 * Convert a parsed CCL config file to ImplementationCapabilities.
 */
export function configFileToCapabilities(
	config: CCLConfigFile,
	overrides?: { name?: string; version?: string },
): ImplementationCapabilities {
	const capabilities: ImplementationCapabilities = {
		name: overrides?.name ?? "ccl-implementation",
		version: overrides?.version ?? "0.0.0",
		functions: config.functions as CCLFunction[],
		features: (config.features ?? []) as CCLFeature[],
		behaviors: (config.behaviors ?? []) as CCLBehavior[],
		variant: (config.variants?.[0] ?? "proposed_behavior") as CCLVariant,
	};

	if (config.skip_tests) {
		capabilities.skipTests = config.skip_tests;
	}

	return capabilities;
}
