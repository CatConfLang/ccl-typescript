#!/usr/bin/env node
/**
 * CLI tool to download CCL test data from GitHub releases.
 *
 * @example
 * ```bash
 * # Download to default location (./ccl-test-data)
 * npx ccl-download-tests
 *
 * # Download to custom location
 * npx ccl-download-tests --output ./my-test-data
 *
 * # Force re-download even if up to date
 * npx ccl-download-tests --force
 *
 * # Download specific version
 * npx ccl-download-tests --version v1.0.0
 *
 * # Download JSON schema only
 * npx ccl-download-tests schema --output ./schemas
 * ```
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { defineCommand, runMain } from "citty";
import consola from "consola";
import { download } from "dill-cli";
import { join } from "pathe";
import {
	type Operation,
	type Task,
	call,
	createScope,
	spawn,
	useAbortSignal,
} from "effection";
import { runOperation } from "./structuredConcurrency.js";

const GITHUB_API_BASE = "https://api.github.com";
const REPO_OWNER = "tylerbutler";
const REPO_NAME = "ccl-test-data";

/** Default output directory for downloaded test data */
const DEFAULT_OUTPUT_DIR = "./ccl-test-data";

/**
 * GitHub release asset information.
 */
interface ReleaseAsset {
	name: string;
	browser_download_url: string;
	size: number;
}

/**
 * GitHub release information.
 */
interface Release {
	tag_name: string;
	name: string;
	published_at: string;
	assets: ReleaseAsset[];
}

/**
 * Options for downloading test data.
 */
export interface DownloadOptions {
	/** Target directory for downloaded files */
	outputDir: string;
	/** Force download even if files exist */
	force?: boolean;
	/** Specific version tag to download (default: latest) */
	version?: string;
}

/**
 * Result of the download operation.
 */
export interface DownloadResult {
	/** Version tag that was downloaded */
	version: string;
	/** Number of files downloaded */
	filesDownloaded: number;
	/** Path to the downloaded files */
	outputDir: string;
}

// ---------------------------------------------------------------------------
// Internal: native effection operations
// ---------------------------------------------------------------------------

/**
 * Fetch a URL as JSON with a scope-bound AbortSignal.
 */
function* fetchJson<T>(url: string): Operation<T> {
	const signal = yield* useAbortSignal();
	const response = yield* call(() =>
		fetch(url, {
			headers: {
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "ccl-test-runner-ts",
			},
			signal,
		}),
	);

	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${response.status} ${response.statusText}`,
		);
	}

	return (yield* call(() => response.json())) as T;
}

function* getLatestReleaseOp(): Operation<Release> {
	return yield* fetchJson<Release>(
		`${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
	);
}

function* getReleaseByTagOp(tag: string): Operation<Release> {
	return yield* fetchJson<Release>(
		`${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${tag}`,
	);
}

function* downloadTestDataOp(
	options: DownloadOptions,
): Operation<DownloadResult> {
	const { outputDir, force = false, version } = options;

	const release = version
		? yield* getReleaseByTagOp(version)
		: yield* getLatestReleaseOp();

	yield* call(() => mkdir(outputDir, { recursive: true }));

	// Check if we have a version marker file
	const versionFile = join(outputDir, ".version");
	if (!force && existsSync(versionFile)) {
		const existingVersion = yield* call(() => readFile(versionFile, "utf-8"));
		if (existingVersion.trim() === release.tag_name) {
			consola.info(`Test data already at version ${release.tag_name}`);
			return {
				version: release.tag_name,
				filesDownloaded: 0,
				outputDir,
			};
		}
	}

	const jsonAssets = release.assets.filter(
		(asset) =>
			asset.name.endsWith(".json") &&
			!asset.name.includes("zip") &&
			asset.name !== "SHA256SUMS",
	);

	consola.start(
		`Downloading ${jsonAssets.length} test files from release ${release.tag_name}...`,
	);

	// Spawn parallel downloads — if any fails, the scope cancels the rest
	const tasks: Task<void>[] = [];
	for (const asset of jsonAssets) {
		const task = yield* spawn(function* () {
			consola.info(`  Downloading ${asset.name}...`);
			yield* call(() =>
				download(asset.browser_download_url, {
					downloadDir: outputDir,
					filename: asset.name,
				}),
			);
		});
		tasks.push(task);
	}
	for (const task of tasks) {
		yield* task;
	}

	yield* call(() => writeFile(versionFile, release.tag_name));

	consola.success(`Downloaded ${jsonAssets.length} files to ${outputDir}`);

	return {
		version: release.tag_name,
		filesDownloaded: jsonAssets.length,
		outputDir,
	};
}

function* downloadSchemaOp(outputDir: string): Operation<void> {
	const release = yield* getLatestReleaseOp();

	const schemaUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${release.tag_name}/schemas/generated-format.json`;

	consola.start(`Downloading schema from release ${release.tag_name}...`);

	yield* call(() => mkdir(outputDir, { recursive: true }));
	yield* call(() =>
		download(schemaUrl, {
			downloadDir: outputDir,
			filename: "generated-format.json",
		}),
	);

	consola.success(`Schema downloaded to ${outputDir}/generated-format.json`);
}

// ---------------------------------------------------------------------------
// Public API: thin async wrappers
// ---------------------------------------------------------------------------

/**
 * Download test data from the ccl-test-data GitHub releases.
 *
 * Downloads the generated test JSON files from the specified release
 * (or latest if not specified) in parallel using dill.
 */
export async function downloadTestData(
	options: DownloadOptions,
): Promise<DownloadResult> {
	return runOperation(function* () {
		return yield* downloadTestDataOp(options);
	});
}

/**
 * Download the JSON schema from the ccl-test-data release.
 */
export async function downloadSchema(outputDir: string): Promise<void> {
	return runOperation(function* () {
		return yield* downloadSchemaOp(outputDir);
	});
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// CLI-level scope: SIGINT/SIGTERM destroy the scope, which halts all
// in-flight operations (fetch requests abort, spawned downloads cancel).
const [cliScope, cliDestroy] = createScope();

process.on("SIGINT", () => {
	consola.info("\nCancelling...");
	cliDestroy().catch(() => {});
});
process.on("SIGTERM", () => {
	cliDestroy().catch(() => {});
});

const schemaCommand = defineCommand({
	meta: {
		name: "schema",
		description: "Download the CCL test data JSON schema",
	},
	args: {
		output: {
			type: "string",
			alias: "o",
			description: "Output directory for schema file",
			default: "./schemas",
		},
	},
	async run({ args }) {
		await cliScope.run(function* () {
			yield* downloadSchemaOp(args.output);
		});
	},
});

const main = defineCommand({
	meta: {
		name: "ccl-download-tests",
		version: "0.1.0",
		description: "Download CCL test data from GitHub releases",
	},
	args: {
		output: {
			type: "string",
			alias: "o",
			description: "Output directory for test data",
			default: DEFAULT_OUTPUT_DIR,
		},
		force: {
			type: "boolean",
			alias: "f",
			description: "Force download even if already up to date",
			default: false,
		},
		version: {
			type: "string",
			alias: "v",
			description: "Specific version tag to download (default: latest)",
		},
	},
	subCommands: {
		schema: schemaCommand,
	},
	async run({ args }) {
		const result = await cliScope.run(function* () {
			return yield* downloadTestDataOp({
				outputDir: args.output,
				force: args.force,
				...(args.version !== undefined && { version: args.version }),
			});
		});

		consola.box(
			`Version: ${result.version}\nFiles: ${result.filesDownloaded}\nPath: ${result.outputDir}`,
		);
	},
});

runMain(main)
	.catch((error: unknown) => {
		consola.error(error);
		process.exit(1);
	})
	.finally(() => {
		cliDestroy().catch(() => {});
	});
