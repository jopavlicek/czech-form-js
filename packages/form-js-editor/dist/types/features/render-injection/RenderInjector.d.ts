/**
 * Manages the rendering of visual plugins.
 * @constructor
 * @param {Object} eventBus - Event bus for the application.
 */
export class RenderInjector extends SectionModuleBase {
    constructor(eventBus: any);
    registeredRenderers: any[];
    /**
     * Inject a new renderer into the injector.
     * @param {string} identifier - Identifier for the renderer.
     * @param {Function} Renderer - The renderer function.
     */
    attachRenderer(identifier: string, Renderer: Function): void;
    /**
     * Detach a renderer from the by key injector.
     * @param {string} identifier - Identifier for the renderer.
     */
    detachRenderer(identifier: string): void;
    /**
     * Returns the registered renderers.
     * @returns {Array} Array of registered renderers.
     */
    fetchRenderers(): any[];
}
export namespace RenderInjector {
    let $inject: string[];
}
import { SectionModuleBase } from '../SectionModuleBase';
