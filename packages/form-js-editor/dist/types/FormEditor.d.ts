export function exportSchema(schema: any, exporter: any, schemaVersion: any): any;
/**
 * @typedef { import('./types').Injector } Injector
 * @typedef { import('./types').Module } Module
 * @typedef { import('./types').Schema } Schema
 *
 * @typedef { import('./types').FormEditorOptions } FormEditorOptions
 * @typedef { import('./types').FormEditorProperties } FormEditorProperties
 *
 * @typedef { {
 *   properties: FormEditorProperties,
 *   schema: Schema
 * } } State
 *
 * @typedef { (type:string, priority:number, handler:Function) => void } OnEventWithPriority
 * @typedef { (type:string, handler:Function) => void } OnEventWithOutPriority
 * @typedef { OnEventWithPriority & OnEventWithOutPriority } OnEventType
 */
/**
 * The form editor.
 */
export class FormEditor {
    /**
     * @constructor
     * @param {FormEditorOptions} options
     */
    constructor(options?: FormEditorOptions);
    /**
     * @public
     * @type {OnEventType}
     */
    public on: OnEventType;
    /**
     * @public
     * @type {String}
     */
    public _id: string;
    /**
     * @private
     * @type {Element}
     */
    private _container;
    /**
     * @private
     * @type {any}
     */
    private exporter;
    /**
     * @private
     * @type {State}
     */
    private _state;
    get: {
        <Name extends never>(name: Name): null[Name];
        <T>(name: string): T;
        <T_1>(name: string, strict: true): T_1;
        <T_2>(name: string, strict: boolean): T_2;
    };
    invoke: {
        <T_3>(func: import("didi").FactoryFunction<T_3>, context?: unknown, locals?: import("didi").LocalsMap): T_3;
        <T_4>(func: import("didi").ArrayFunc<T_4>, context?: unknown, locals?: import("didi").LocalsMap): T_4;
    };
    clear(): void;
    destroy(): void;
    /**
     * @param {Schema} schema
     *
     * @return {Promise<{ warnings: Array<any> }>}
     */
    importSchema(schema: Schema): Promise<{
        warnings: Array<any>;
    }>;
    /**
     * @returns {Schema}
     */
    saveSchema(): Schema;
    /**
     * @returns {Schema}
     */
    getSchema(): Schema;
    /**
     * @param {Element|string} parentNode
     */
    attachTo(parentNode: Element | string): void;
    detach(): void;
    /**
     * @internal
     *
     * @param {boolean} [emit]
     */
    _detach(emit?: boolean): void;
    /**
     * @param {any} property
     * @param {any} value
     */
    setProperty(property: any, value: any): void;
    /**
     * @param {string} type
     * @param {Function} handler
     */
    off(type: string, handler: Function): void;
    /**
     * @internal
     *
     * @param {FormEditorOptions} options
     * @param {Element} container
     *
     * @returns {Injector}
     */
    _createInjector(options: FormEditorOptions, container: Element): Injector;
    /**
     * @internal
     */
    _emit(type: any, data: any): void;
    /**
     * @internal
     */
    _getState(): State;
    /**
     * @internal
     */
    _setState(state: any): void;
    /**
     * @internal
     */
    _getModules(): ({
        __depends__: import("didi").ModuleDeclaration[];
        editorActions: (string | typeof import("./features/editor-actions/FormEditorActions").FormEditorActions)[];
    } | {
        __init__: string[];
        expressionLanguage: (string | typeof import("@bpmn-io/form-js-viewer").FeelExpressionLanguage)[];
        templating: (string | typeof import("./features/expression-language/EditorTemplating").EditorTemplating)[];
    } | {
        __depends__: import("didi").ModuleDeclaration[];
        __init__: string[];
        keyboardBindings: (string | typeof import("./features/keyboard/FormEditorKeyboardBindings").FormEditorKeyboardBindings)[];
    } | {
        __init__: string[];
        dragging: (string | typeof import("./features/dragging/Dragging").Dragging)[];
    } | {
        __depends__: (import("didi").ModuleDeclaration | {
            __init__: string[];
            idBehavior: (string | typeof import("./features/modeling/behavior/IdBehavior").IdBehavior)[];
            keyBehavior: (string | typeof import("./features/modeling/behavior/KeyBehavior").KeyBehavior)[];
            pathBehavior: (string | typeof import("./features/modeling/behavior/PathBehavior").PathBehavior)[];
            validateBehavior: (string | typeof import("./features/modeling/behavior/ValidateBehavior").ValidateBehavior)[];
            optionsSourceBehavior: (string | typeof import("./features/modeling/behavior/OptionsSourceBehavior").OptionsSourceBehavior)[];
            columnsSourceBehavior: (string | typeof import("./features/modeling/behavior/ColumnsSourceBehavior").ColumnsSourceBehavior)[];
            tableDataSourceBehavior: (string | typeof import("./features/modeling/behavior/TableDataSourceBehavior").TableDataSourceBehavior)[];
        })[];
        __init__: string[];
        formLayoutUpdater: (string | typeof import("./features/modeling/FormLayoutUpdater").FormLayoutUpdater)[];
        modeling: (string | typeof import("./features/modeling/Modeling").Modeling)[];
    } | {
        __init__: string[];
        selection: (string | typeof import("./features/selection/Selection").Selection)[];
        selectionBehavior: (string | typeof import("./features/selection/SelectionBehavior").SelectionBehavior)[];
    } | {
        __init__: string[];
        palette: (string | typeof import("./features/palette/PaletteRenderer").PaletteRenderer)[];
    } | {
        __depends__: any[];
        __init__: string[];
        propertiesPanel: (string | typeof import("./features/properties-panel/PropertiesPanelRenderer").PropertiesPanelRenderer)[];
        propertiesProvider: (string | typeof import("./features/properties-panel/PropertiesProvider").PropertiesProvider)[];
    } | {
        __init__: string[];
        renderInjector: (string | typeof import("./features/render-injection/RenderInjector").RenderInjector)[];
    } | {
        __init__: string[];
        repeatRenderManager: (string | typeof import("./features/repeat-render").EditorRepeatRenderManager)[];
    } | typeof MarkdownRendererModule)[];
    /**
     * @internal
     */
    _onEvent(type: any, priority: any, handler: any): void;
}
export type Injector = import('./types').Injector;
export type Module = import('./types').Module;
export type Schema = import('./types').Schema;
export type FormEditorOptions = import('./types').FormEditorOptions;
export type FormEditorProperties = import('./types').FormEditorProperties;
export type State = {
    properties: FormEditorProperties;
    schema: Schema;
};
export type OnEventWithPriority = (type: string, priority: number, handler: Function) => void;
export type OnEventWithOutPriority = (type: string, handler: Function) => void;
export type OnEventType = OnEventWithPriority & OnEventWithOutPriority;
import { MarkdownRendererModule } from '@bpmn-io/form-js-viewer';
