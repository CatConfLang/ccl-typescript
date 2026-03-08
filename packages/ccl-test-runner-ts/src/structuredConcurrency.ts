/**
 * Structured concurrency utilities built on effection v4.
 */

import { type Operation, createScope } from "effection";

/**
 * Run an effection operation from async code. Creates a temporary scope,
 * runs the operation, and tears down the scope when done.
 */
export async function runOperation<T>(op: () => Operation<T>): Promise<T> {
	const [scope, destroy] = createScope();
	try {
		return await scope.run(op);
	} finally {
		await destroy();
	}
}
