/**
 * Generate a markdown "nutrition facts label" summary from a CCL test results
 * document. Consumes the CCLTestResults format and produces a rollup suitable
 * for READMEs, PR comments, or scorecards.
 */

import { categorizeSkipReason, type CCLTestResults, type TestOutcome } from "./test-results.js";

export interface GenerateNutritionLabelOptions {
	/** Max length of error messages in the failures section. Default 120. */
	maxErrorLength?: number;
	/** Max number of failures to list. Default 25. */
	maxFailures?: number;
}

const SCHEMA_ID = "test-results-format";

/**
 * Generate a markdown summary of the given test results.
 *
 * Performs a sanity check on the `$schema` URL — it must reference
 * `test-results-format` — but does not otherwise validate the document.
 */
export function generateNutritionLabel(
	results: CCLTestResults,
	options: GenerateNutritionLabelOptions = {},
): string {
	if (!results.$schema || !results.$schema.includes(SCHEMA_ID)) {
		throw new Error(
			`Unsupported $schema for test results: ${results.$schema ?? "<missing>"} (expected URL containing "${SCHEMA_ID}")`,
		);
	}

	const maxErrorLength = options.maxErrorLength ?? 120;
	const maxFailures = options.maxFailures ?? 25;

	const { implementation, testSuite, tests, generatedAt } = results;
	const counts = countOutcomes(tests);
	const total = tests.length;

	const lines: string[] = [];

	lines.push(`# CCL Test Results: ${implementation.name} ${implementation.version}`);
	lines.push("");
	lines.push(
		`- **Language:** ${implementation.language}`,
		`- **Variant:** ${implementation.variant}`,
		`- **Test suite:** ${testSuite.version ?? "unknown"} (${testSuite.totalTests} tests)`,
		`- **Generated:** ${generatedAt}`,
	);
	lines.push("");

	lines.push("## Summary");
	lines.push("");
	lines.push("| Outcome | Count | Percent |");
	lines.push("| --- | ---: | ---: |");
	lines.push(`| Pass | ${counts.pass} | ${pct(counts.pass, total)} |`);
	lines.push(`| Fail | ${counts.fail} | ${pct(counts.fail, total)} |`);
	lines.push(`| Skip | ${counts.skip} | ${pct(counts.skip, total)} |`);
	lines.push(`| Todo | ${counts.todo} | ${pct(counts.todo, total)} |`);
	lines.push(`| **Total** | **${total}** | 100% |`);
	lines.push("");

	lines.push("## By Validation");
	lines.push("");
	lines.push("| Validation | Pass | Fail | Skip | Todo | Total | Implemented |");
	lines.push("| --- | ---: | ---: | ---: | ---: | ---: | :---: |");
	const implemented = new Set(implementation.implementedFunctions);
	const byValidation = groupByValidation(tests);
	const validationNames = [...byValidation.keys()].sort();
	for (const name of validationNames) {
		const group = byValidation.get(name);
		if (!group) continue;
		const c = countOutcomes(group);
		lines.push(
			`| ${name} | ${c.pass} | ${c.fail} | ${c.skip} | ${c.todo} | ${group.length} | ${implemented.has(name) ? "yes" : "no"} |`,
		);
	}
	lines.push("");

	if (counts.skip > 0) {
		lines.push("## Skip Reasons");
		lines.push("");
		lines.push("| Category | Count |");
		lines.push("| --- | ---: |");
		const skipCategories = countSkipCategories(tests);
		for (const [category, count] of skipCategories) {
			lines.push(`| ${category} | ${count} |`);
		}
		lines.push("");
	}

	if (counts.fail > 0) {
		const failures = tests.filter((t) => t.outcome === "fail");
		lines.push(`## Failures (${failures.length})`);
		lines.push("");
		const shown = failures.slice(0, maxFailures);
		for (const f of shown) {
			const err = f.error ? `: ${truncate(f.error, maxErrorLength)}` : "";
			lines.push(`- \`${f.name}\` (${f.validation})${err}`);
		}
		if (failures.length > shown.length) {
			lines.push(`- …and ${failures.length - shown.length} more`);
		}
		lines.push("");
	}

	return `${lines.join("\n").trimEnd()}\n`;
}

interface OutcomeCounts {
	pass: number;
	fail: number;
	skip: number;
	todo: number;
}

function countOutcomes(tests: TestOutcome[]): OutcomeCounts {
	const counts: OutcomeCounts = { pass: 0, fail: 0, skip: 0, todo: 0 };
	for (const t of tests) counts[t.outcome]++;
	return counts;
}

function groupByValidation(tests: TestOutcome[]): Map<string, TestOutcome[]> {
	const map = new Map<string, TestOutcome[]>();
	for (const t of tests) {
		const existing = map.get(t.validation);
		if (existing) existing.push(t);
		else map.set(t.validation, [t]);
	}
	return map;
}

function countSkipCategories(tests: TestOutcome[]): [string, number][] {
	const counts = new Map<string, number>();
	for (const t of tests) {
		if (t.outcome !== "skip") continue;
		const category = t.reason ? categorizeSkipReason(t.reason) : "other";
		counts.set(category, (counts.get(category) ?? 0) + 1);
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function pct(n: number, total: number): string {
	if (total === 0) return "0%";
	return `${((n / total) * 100).toFixed(1)}%`;
}

function truncate(s: string, max: number): string {
	const oneLine = s.replace(/\s+/g, " ").trim();
	return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}
