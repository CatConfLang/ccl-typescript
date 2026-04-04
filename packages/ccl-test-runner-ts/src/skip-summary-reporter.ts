/**
 * Custom vitest reporter that summarizes skipped tests by category.
 *
 * Collects skip reasons from `context.skip(reason)` calls and groups them
 * for a summary at the end of the test run.
 */
import type { Reporter, TestCase, TestModule } from "vitest/node";

/**
 * Categories for skip reasons.
 */
type SkipCategory = "function" | "feature" | "behavior" | "variant" | "conflict" | "other";

/**
 * Parsed skip reason with category and detail.
 */
interface ParsedSkipReason {
	category: SkipCategory;
	detail: string;
}

/**
 * Category keywords for detection.
 */
const CATEGORY_KEYWORDS: SkipCategory[] = [
	"function",
	"feature",
	"behavior",
	"variant",
	"conflict",
];

/**
 * Try to match a category from the given text.
 */
function matchCategory(text: string): SkipCategory | null {
	const lower = text.toLowerCase();
	for (const category of CATEGORY_KEYWORDS) {
		if (lower === category || lower.includes(category)) {
			return category;
		}
	}
	return null;
}

/**
 * Parse a skip note into category and detail.
 *
 * Expected formats:
 * - "function:parse" → category: function, detail: parse
 * - "Missing required functions: parse, build_hierarchy" → category: function, detail: parse, build_hierarchy
 * - "Behavior conflict: ..." → category: behavior, detail: ...
 */
function parseSkipNote(note: string): ParsedSkipReason {
	// Check for "category:detail" format
	const colonIndex = note.indexOf(":");
	if (colonIndex > 0) {
		const prefix = note.slice(0, colonIndex).trim();
		const detail = note.slice(colonIndex + 1).trim();
		const category = matchCategory(prefix);
		if (category) {
			return { category, detail };
		}
	}

	// Fallback: detect category from entire content
	const category = matchCategory(note);
	if (category) {
		return { category, detail: note };
	}

	return { category: "other", detail: note };
}

/**
 * Normalize a function detail string to just the function name(s).
 *
 * Strips verbose suffixes and parentheticals from function skip reasons:
 * - "parse not supported" → "parse"
 * - "parse (required for round_trip) not supported" → "parse"
 * - "parse declared but not implemented" → "parse"
 * - "parse, build_hierarchy" → "parse, build_hierarchy" (multi kept as-is)
 */
export function normalizeFunctionDetail(detail: string): string {
	return detail
		.replace(/\s*\(required for [^)]+\)/g, "")
		.replace(/\s+not supported$/, "")
		.replace(/\s+declared but not implemented$/, "")
		.trim();
}

/**
 * Format a behavior detail string for compact display.
 *
 * - "test requires boolean_strict, implementation uses boolean_lenient" → "boolean_strict (impl: boolean_lenient)"
 * - "test conflicts with boolean_strict" → "boolean_strict (excluded)"
 * - plain string → returned as-is
 */
export function formatBehaviorDetail(raw: string): string {
	const reqMatch = raw.match(/test requires (\S+), implementation uses (\S+)/);
	if (reqMatch) return `${reqMatch[1]} (impl: ${reqMatch[2]})`;

	const conflictMatch = raw.match(/test conflicts with (.+)/);
	if (conflictMatch) return `${conflictMatch[1]} (excluded)`;

	return raw;
}

/**
 * Format a variant detail string for compact display.
 *
 * - "test requires X or Y, implementation uses Z" → "requires X or Y"
 * - "test conflicts with X" → "X (excluded)"
 * - plain string → returned as-is
 *
 * Note: unlike formatBehaviorDetail, we omit the implementation side for variants.
 * The implementation's variant is already known context (it's a single fixed choice
 * per run), so repeating it on every skip line adds noise rather than information.
 */
export function formatVariantDetail(raw: string): string {
	const mismatchMatch = raw.match(/test requires (.+), implementation uses \S+/);
	if (mismatchMatch) return `requires ${mismatchMatch[1]}`;

	const conflictMatch = raw.match(/test conflicts with (.+)/);
	if (conflictMatch) return `${conflictMatch[1]} (excluded)`;

	return raw;
}

/**
 * Reporter that collects and summarizes skip reasons.
 */
export default class SkipSummaryReporter implements Reporter {
	private skippedByReason = new Map<string, number>();
	private todoByFunction = new Map<string, number>();
	private todoCount = 0;
	private passedCount = 0;
	private failedCount = 0;
	private skippedCount = 0;

	onTestCaseResult(testCase: TestCase): void {
		const result = testCase.result();

		switch (result.state) {
			case "passed":
				this.passedCount++;
				break;
			case "failed":
				this.failedCount++;
				break;
			case "skipped":
				// Check if it's a todo vs regular skip
				if (testCase.options.mode === "todo") {
					this.todoCount++;
					// Get function name from parent describe block
					const parent = testCase.parent;
					const fnName = parent.type === "suite" ? parent.name : "unknown";
					this.todoByFunction.set(fnName, (this.todoByFunction.get(fnName) ?? 0) + 1);
				} else {
					this.skippedCount++;
					// Track the skip reason
					const note = result.note ?? "No reason provided";
					const { category, detail } = parseSkipNote(note);
					const normalizedDetail =
						category === "function" ? normalizeFunctionDetail(detail) : detail;
					const key = `${category}:${normalizedDetail}`;
					this.skippedByReason.set(key, (this.skippedByReason.get(key) ?? 0) + 1);
				}
				break;
			default:
				// Other states (e.g., pending) - no action needed
				break;
		}
	}

	onTestRunEnd(_testModules: readonly TestModule[]): void {
		this.printSummary();
	}

	/**
	 * Group skip reasons by category.
	 */
	private groupByCategory(): Map<SkipCategory, Map<string, number>> {
		const byCategory = new Map<SkipCategory, Map<string, number>>();

		for (const [key, count] of this.skippedByReason) {
			const colonIndex = key.indexOf(":");
			const category = key.slice(0, colonIndex) as SkipCategory;
			const detail = key.slice(colonIndex + 1);

			if (!byCategory.has(category)) {
				byCategory.set(category, new Map());
			}
			byCategory.get(category)?.set(detail, count);
		}

		return byCategory;
	}

	/**
	 * Format a detail string for a given category.
	 */
	private formatDetail(category: SkipCategory, detail: string): string {
		switch (category) {
			case "behavior":
				return formatBehaviorDetail(detail);
			case "variant":
				return formatVariantDetail(detail);
			default:
				return detail;
		}
	}

	/**
	 * Print a single category section.
	 */
	private printCategorySection(
		label: string,
		category: SkipCategory,
		details: Map<string, number>,
	): void {
		const categoryTotal = [...details.values()].reduce((sum, count) => sum + count, 0);

		console.log(`│${`  ${label}`.padEnd(50)}${`${categoryTotal}`.padStart(10)}  │`);

		// Sort by count descending, show top items
		const sortedDetails = [...details.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

		for (const [detail, count] of sortedDetails) {
			const formatted = this.formatDetail(category, detail);
			// Max display length is 43 chars (full available space); keep 40 content chars + "..."
			const truncated = formatted.length > 43 ? `${formatted.slice(0, 40)}...` : formatted;
			console.log(`│${`    └─ ${truncated}`.padEnd(50)}${`${count}`.padStart(10)}  │`);
		}

		if (details.size > 5) {
			console.log(`│${`    └─ ... and ${details.size - 5} more`.padEnd(50)}${"".padStart(10)}  │`);
		}
	}

	/**
	 * Print the todo section.
	 */
	private printTodoSection(): void {
		if (this.todoByFunction.size === 0) return;

		const label = "Todo (not yet implemented)";
		const todoTotal = [...this.todoByFunction.values()].reduce((sum, n) => sum + n, 0);
		console.log(`│${`  ${label}`.padEnd(50)}${`${todoTotal}`.padStart(10)}  │`);

		const sorted = [...this.todoByFunction.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
		for (const [fn, count] of sorted) {
			console.log(`│${`    └─ ${fn}`.padEnd(50)}${`${count}`.padStart(10)}  │`);
		}

		if (this.todoByFunction.size > 5) {
			console.log(
				`│${`    └─ ... and ${this.todoByFunction.size - 5} more`.padEnd(50)}${"".padStart(10)}  │`,
			);
		}
	}

	/**
	 * Print the summary footer with totals.
	 */
	private printTotals(): void {
		console.log(`├${"─".repeat(62)}┤`);
		console.log(`│${"  Passed".padEnd(50)}${`${this.passedCount}`.padStart(10)}  │`);
		console.log(`│${"  Failed".padEnd(50)}${`${this.failedCount}`.padStart(10)}  │`);
		console.log(`│${"  Skipped".padEnd(50)}${`${this.skippedCount}`.padStart(10)}  │`);
		console.log(`│${"  Todo".padEnd(50)}${`${this.todoCount}`.padStart(10)}  │`);
		console.log(`├${"─".repeat(62)}┤`);

		const total = this.passedCount + this.failedCount + this.skippedCount + this.todoCount;
		console.log(`│${"  Total".padEnd(50)}${`${total}`.padStart(10)}  │`);
		console.log(`└${"─".repeat(62)}┘`);
		console.log("");
	}

	private printSummary(): void {
		if (this.skippedCount === 0 && this.todoCount === 0) {
			return;
		}

		const byCategory = this.groupByCategory();

		// Print header
		console.log("\n");
		console.log(`┌${"─".repeat(62)}┐`);
		console.log(`│${"  CCL Test Summary".padEnd(62)}│`);
		console.log(`├${"─".repeat(62)}┤`);

		// Category labels and order
		const categoryLabels: Record<SkipCategory, string> = {
			function: "Unsupported Functions",
			feature: "Missing Features",
			behavior: "Behavior Conflicts",
			variant: "Variant Mismatches",
			conflict: "Other Conflicts",
			other: "Other Reasons",
		};

		const categoryOrder: SkipCategory[] = [
			"function",
			"feature",
			"behavior",
			"variant",
			"conflict",
			"other",
		];

		let hasSkipDetails = false;
		for (const category of categoryOrder) {
			const details = byCategory.get(category);
			if (details && details.size > 0) {
				hasSkipDetails = true;
				this.printCategorySection(categoryLabels[category], category, details);
			}
		}

		if (!hasSkipDetails && this.skippedCount > 0) {
			console.log(
				`│${"  Skipped (no reason)".padEnd(50)}${`${this.skippedCount}`.padStart(10)}  │`,
			);
		}

		this.printTodoSection();

		this.printTotals();
	}
}
