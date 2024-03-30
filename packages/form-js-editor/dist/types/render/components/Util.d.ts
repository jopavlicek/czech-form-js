export function editorFormFieldClasses(type: any, { disabled }?: {
    disabled?: boolean;
}): any;
/**
 * Add a dragger that calls back the passed function with
 * { event, delta } on drag.
 *
 * @example
 *
 * function dragMove(event, delta) {
 *   // we are dragging (!!)
 * }
 *
 * domElement.addEventListener('dragstart', dragger(dragMove));
 *
 * @param {Function} fn
 *
 * @return {Function} drag start callback function
 */
export function createDragger(fn: Function): Function;
/**
 * Throttle function call according UI update cycle.
 *
 * @param  {Function} fn
 *
 * @return {Function} throttled fn
 */
export function throttle(fn: Function): Function;
