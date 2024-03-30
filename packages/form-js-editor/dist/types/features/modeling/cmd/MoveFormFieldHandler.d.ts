export class MoveFormFieldHandler {
    /**
     * @constructor
     * @param { import('../../../FormEditor').FormEditor } formEditor
     * @param { import('../../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
     * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
     * @param { import('@bpmn-io/form-js-viewer').FormLayouter } formLayouter
     */
    constructor(formEditor: import('../../../FormEditor').FormEditor, formFieldRegistry: import('../../../core/FormFieldRegistry').FormFieldRegistry, pathRegistry: import('@bpmn-io/form-js-viewer').PathRegistry, formLayouter: import('@bpmn-io/form-js-viewer').FormLayouter);
    _formEditor: import("../../../FormEditor").FormEditor;
    _formFieldRegistry: import("../../../core/FormFieldRegistry").FormFieldRegistry;
    _pathRegistry: import("@bpmn-io/form-js-viewer").PathRegistry;
    _formLayouter: import("@bpmn-io/form-js-viewer").FormLayouter;
    execute(context: any): void;
    revert(context: any): void;
    moveFormField(context: any, revert: any): void;
}
export namespace MoveFormFieldHandler {
    let $inject: string[];
}
