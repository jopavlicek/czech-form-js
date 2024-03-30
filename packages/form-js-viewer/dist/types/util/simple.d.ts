export function isRequired(field: any): any;
export function pathParse(path: any): any;
export function pathsEqual(a: any, b: any): any;
export function generateIndexForType(type: any): any;
export function generateIdForType(type: any): string;
/**
 * @template T
 * @param {T} data
 * @param {(this: any, key: string, value: any) => any} [replacer]
 * @return {T}
 */
export function clone<T>(data: T, replacer?: (this: any, key: string, value: any) => any): T;
/**
 * Transform a LocalExpressionContext object into a usable FEEL context.
 *
 * @param {Object} context - The LocalExpressionContext object.
 * @returns {Object} The usable FEEL context.
 */
export function buildExpressionContext(context: any): any;
export function runRecursively(formField: any, fn: any): void;
