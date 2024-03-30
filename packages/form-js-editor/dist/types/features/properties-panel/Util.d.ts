export function arrayAdd(array: any, index: any, item: any): any[];
export function arrayRemove(array: any, index: any): any[];
export function prefixId(id: any): string;
export function countDecimals(number: any): any;
/**
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidNumber(value: unknown): boolean;
export function stopPropagation(listener: any): (event: any) => void;
export function textToLabel(text: any): string;
/**
  * @param {string} path
  */
export function isValidDotPath(path: string): boolean;
/**
  * @param {string} path
  */
export function isProhibitedPath(path: string): boolean;
export function hasEntryConfigured(formFieldDefinition: any, entryId: any): any;
export function hasOptionsGroupsConfigured(formFieldDefinition: any): any;
/**
  * @param {string} path
  */
export function hasIntegerPathSegment(path: string): boolean;
export const LABELED_NON_INPUTS: string[];
export const INPUTS: string[];
export const OPTIONS_INPUTS: string[];
