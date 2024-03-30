export const DRAG_CONTAINER_CLS: "fjs-drag-container";
export const DROP_CONTAINER_VERTICAL_CLS: "fjs-drop-container-vertical";
export const DROP_CONTAINER_HORIZONTAL_CLS: "fjs-drop-container-horizontal";
export const DRAG_MOVE_CLS: "fjs-drag-move";
export const DRAG_ROW_MOVE_CLS: "fjs-drag-row-move";
export const DRAG_COPY_CLS: "fjs-drag-copy";
export const DRAG_NO_DROP_CLS: "fjs-no-drop";
export const DRAG_NO_MOVE_CLS: "fjs-no-move";
export const ERROR_DROP_CLS: "fjs-error-drop";
/**
 * @typedef { { id: String, components: Array<any> } } FormRow
 */
export class Dragging {
    /**
     * @constructor
     *
     * @param { import('../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
     * @param { import('../../core/FormLayouter').FormLayouter } formLayouter
     * @param { import('../../core/FormLayoutValidator').FormLayoutValidator } formLayoutValidator
     * @param { import('../../core/EventBus').EventBus } eventBus
     * @param { import('../modeling/Modeling').Modeling } modeling
     * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
     */
    constructor(formFieldRegistry: import('../../core/FormFieldRegistry').FormFieldRegistry, formLayouter: import('../../core/FormLayouter').FormLayouter, formLayoutValidator: import('../../core/FormLayoutValidator').FormLayoutValidator, eventBus: import('../../core/EventBus').EventBus, modeling: import('../modeling/Modeling').Modeling, pathRegistry: import('@bpmn-io/form-js-viewer').PathRegistry);
    _formFieldRegistry: import("../../core/FormFieldRegistry").FormFieldRegistry;
    _formLayouter: import("@bpmn-io/form-js-viewer").FormLayouter;
    _formLayoutValidator: import("../../core/FormLayoutValidator").FormLayoutValidator;
    _eventBus: import("diagram-js/lib/core/EventBus").default<null>;
    _modeling: import("../modeling/Modeling").Modeling;
    _pathRegistry: import("@bpmn-io/form-js-viewer").PathRegistry;
    /**
     * Calculates position in form schema given the dropped place.
     *
     * @param { FormRow } targetRow
     * @param { any } targetFormField
     * @param { HTMLElement } sibling
     * @returns { number }
     */
    getTargetIndex(targetRow: FormRow, targetFormField: any, sibling: HTMLElement): number;
    validateDrop(element: any, target: any): "Minimální šířka je 2 sloupců" | "Maximální šířka je 16 sloupců" | "Nová hodnota předahuje maximum 16 sloupců na řádek" | "Byl přesažen maximální počet polí na řádek 4" | "Drop is not a valid target" | "Drop not allowed by path registry";
    moveField(element: any, source: any, targetRow: any, targetFormField: any, targetIndex: any): void;
    createNewField(element: any, targetRow: any, targetFormField: any, targetIndex: any): void;
    handleRowDrop(el: any, target: any, source: any, sibling: any): void;
    handleElementDrop(el: any, target: any, source: any, sibling: any, drake: any): any;
    /**
     * @param { { container: Array<string>, direction: string, mirrorContainer: string } } options
     */
    createDragulaInstance(options: {
        container: Array<string>;
        direction: string;
        mirrorContainer: string;
    }): any;
    emit(event: any, context: any): void;
}
export namespace Dragging {
    let $inject: string[];
}
export type FormRow = {
    id: string;
    components: Array<any>;
};
