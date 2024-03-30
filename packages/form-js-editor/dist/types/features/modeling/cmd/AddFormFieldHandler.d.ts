export class AddFormFieldHandler {
    /**
     * @constructor
     * @param { import('../../../FormEditor').FormEditor } formEditor
     * @param { import('../../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
     */
    constructor(formEditor: import('../../../FormEditor').FormEditor, formFieldRegistry: import('../../../core/FormFieldRegistry').FormFieldRegistry);
    _formEditor: import("../../../FormEditor").FormEditor;
    _formFieldRegistry: import("../../../core/FormFieldRegistry").FormFieldRegistry;
    execute(context: any): void;
    revert(context: any): void;
}
export namespace AddFormFieldHandler {
    let $inject: string[];
}
