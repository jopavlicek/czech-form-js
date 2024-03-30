/**
 * @typedef { { parent: Element } } PropertiesPanelConfig
 * @typedef { import('../../core/EventBus').EventBus } EventBus
 * @typedef { import('../../types').Injector } Injector
 * @typedef { { getGroups: ({ formField, editFormField }) => ({ groups}) => Array } } PropertiesProvider
 */
/**
 * @param {PropertiesPanelConfig} propertiesPanelConfig
 * @param {Injector} injector
 * @param {EventBus} eventBus
 */
export class PropertiesPanelRenderer {
    constructor(propertiesPanelConfig: any, injector: any, eventBus: any);
    _eventBus: any;
    _injector: any;
    _container: HTMLElement;
    /**
     * Attach the properties panel to a parent node.
     *
     * @param {HTMLElement} container
     */
    attachTo(container: HTMLElement): void;
    /**
     * Detach the properties panel from its parent node.
     */
    detach(): void;
    _render(): void;
    _destroy(): void;
    /**
     * Register a new properties provider to the properties panel.
     *
     * @param {PropertiesProvider} provider
     * @param {Number} [priority]
     */
    registerProvider(provider: PropertiesProvider, priority?: number): void;
    _getProviders(): any;
}
export namespace PropertiesPanelRenderer {
    let $inject: string[];
}
export type PropertiesPanelConfig = {
    parent: Element;
};
export type EventBus = import('../../core/EventBus').EventBus;
export type Injector = import('../../types').Injector;
export type PropertiesProvider = {
    getGroups: ({ formField, editFormField }: {
        formField: any;
        editFormField: any;
    }) => ({ groups }: {
        groups: any;
    }) => any[];
};
