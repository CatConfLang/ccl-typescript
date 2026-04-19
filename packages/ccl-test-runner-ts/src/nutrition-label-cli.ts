#!/usr/bin/env node
/**
 * CLI tool to generate a markdown "nutrition facts label" from a CCL test
 * results JSON document.
 *
 * @example
 * ```bash
 * npx ccl-nutrition-label results.json
 * npx ccl-nutrition-label results.json --output label.md
 * ```
 */

import { readFile, writeFile } from "node:fs/promises";
import { defineCommand, runMain } from "citty";
import consola from "consola";
import { resolve } from "pathe";
import { generateNutritionLabel } from "./nutrition-label.js";
import type { CCLTestResults } from "./test-results.js";

const main = defineCommand({
	meta: {
		name: "ccl-nutrition-label",
		version: "0.1.0",
		description: "Generate a markdown rollup from CCL test results JSON",
	},
	args: {
		input: {
			type: "positional",
			description: "Path to the test results JSON file",
			required: true,
		},
		output: {
			type: "string",
			alias: "o",
			description: "Write markdown to this file instead of stdout",
		},
		maxFailures: {
			type: "string",
			description: "Max number of failures to list (default 25)",
		},
		maxErrorLength: {
			type: "string",
			description: "Max length of each error message (default 120)",
		},
	},
	async run({ args }) {
		const inputPath = resolve(args.input);
		const raw = await readFile(inputPath, "utf-8");

		let results: CCLTestResults;
		try {
			results = JSON.parse(raw) as CCLTestResults;
		} catch (e) {
			consola.error(`Failed to parse JSON in ${inputPath}: ${(e as Error).message}`);
			process.exit(1);
		}

		const markdown = generateNutritionLabel(results, {
			...(args.maxFailures ? { maxFailures: Number.parseInt(args.maxFailures, 10) } : {}),
			...(args.maxErrorLength
				? { maxErrorLength: Number.parseInt(args.maxErrorLength, 10) }
				: {}),
		});

		if (args.output) {
			await writeFile(resolve(args.output), markdown);
			consola.success(`Wrote label to ${args.output}`);
		} else {
			process.stdout.write(markdown);
		}
	},
});

runMain(main).catch((error: unknown) => {
	consola.error(error);
	process.exit(1);
});
