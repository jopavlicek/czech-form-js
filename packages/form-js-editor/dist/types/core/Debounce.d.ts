/**
 * A factory to create a configurable debouncer.
 *
 * @param {number|boolean} [config=true]
 */
export function DebounceFactory(config?: number | boolean): (fn: any) => any;
export namespace DebounceFactory {
    let $inject: string[];
}
