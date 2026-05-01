/**
 * ccl-zod — Zod schema integration for CCL.
 *
 * Extract typed JavaScript objects from CCLObjects using Zod schemas.
 * See https://catconflang.com for the CCL specification.
 *
 * @packageDocumentation
 */

export { cclBoolean } from "./cclBoolean.js";
export type { ExtractionError, FieldError } from "./errors.js";
export { extract } from "./extract.js";
