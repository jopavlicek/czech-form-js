export class EditorRepeatRenderManager {
    constructor(formFields: any, formFieldRegistry: any);
    _formFields: any;
    _formFieldRegistry: any;
    RepeatFooter(): import("preact").JSX.Element;
    /**
     * Checks whether a field should be repeatable.
     *
     * @param {string} id - The id of the field to check
     * @returns {boolean} - True if repeatable, false otherwise
     */
    isFieldRepeating(id: string): boolean;
}
export namespace EditorRepeatRenderManager {
    let $inject: string[];
}
