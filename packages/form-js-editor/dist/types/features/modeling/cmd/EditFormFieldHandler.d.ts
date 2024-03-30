export class EditFormFieldHandler {
    /**
     * @constructor
     * @param { import('../../../FormEditor').FormEditor } formEditor
     * @param { import('../../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
     */
    constructor(formEditor: import('../../../FormEditor').FormEditor, formFieldRegistry: import('../../../core/FormFieldRegistry').FormFieldRegistry);
    _formEditor: import("../../../FormEditor").FormEditor;
    _formFieldRegistry: import("../../../core/FormFieldRegistry").FormFieldRegistry;
    execute(context: any): any;
    revert(context: any): any;
}
export namespace EditFormFieldHandler {
    let $inject: string[];
}
