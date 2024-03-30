/**
 * @typedef { { container: Element, compact?: boolean } } RenderConfig
 * @typedef { import('didi').Injector } Injector
 * @typedef { import('../core/EventBus').EventBus } EventBus
 * @typedef { import('../FormEditor').FormEditor } FormEditor
 */
/**
 * @param {RenderConfig} renderConfig
 * @param {EventBus} eventBus
 * @param {FormEditor} formEditor
 * @param {Injector} injector
 */
export class Renderer {
    constructor(renderConfig: any, eventBus: any, formEditor: any, injector: any);
}
export namespace Renderer {
    let $inject: string[];
}
export type RenderConfig = {
    container: Element;
    compact?: boolean;
};
export type Injector = import('didi').Injector;
export type EventBus = import('../core/EventBus').EventBus;
export type FormEditor = import('../FormEditor').FormEditor;
