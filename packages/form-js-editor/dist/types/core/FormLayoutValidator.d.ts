export const MAX_COLUMNS_PER_ROW: 16;
export const MAX_COLUMNS: 16;
export const MIN_COLUMNS: 2;
export const MAX_FIELDS_PER_ROW: 4;
export class FormLayoutValidator {
    /**
     * @constructor
     *
     * @param { import('./FormLayouter').FormLayouter } formLayouter
     * @param { import('./FormFieldRegistry').FormFieldRegistry } formFieldRegistry
     */
    constructor(formLayouter: import('./FormLayouter').FormLayouter, formFieldRegistry: import('./FormFieldRegistry').FormFieldRegistry);
    _formLayouter: import("@bpmn-io/form-js-viewer/dist/types/core/FormLayouter").FormLayouter;
    _formFieldRegistry: import("./FormFieldRegistry").FormFieldRegistry;
    validateField(field: {}, columns: any, row: any): "Minimální šířka je 2 sloupců" | "Maximální šířka je 16 sloupců" | "Nová hodnota předahuje maximum 16 sloupců na řádek" | "Byl přesažen maximální počet polí na řádek 4";
}
export namespace FormLayoutValidator {
    let $inject: string[];
}
