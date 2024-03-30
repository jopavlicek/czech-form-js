export class UpdatePathClaimHandler {
    /**
     * @constructor
     * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
     */
    constructor(pathRegistry: import('@bpmn-io/form-js-viewer').PathRegistry);
    _pathRegistry: import("@bpmn-io/form-js-viewer").PathRegistry;
    execute(context: any): void;
    revert(context: any): void;
}
export namespace UpdatePathClaimHandler {
    let $inject: string[];
}
