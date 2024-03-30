/**
 * Base class for sectionable UI modules.
 *
 * @property {EventBus} _eventBus - EventBus instance used for event handling.
 * @property {string} managerType - Type of the render manager. Used to form event names.
 *
 * @class SectionModuleBase
 */
export class SectionModuleBase {
    /**
     * Create a SectionModuleBase instance.
     *
     * @param {any} eventBus - The EventBus instance used for event handling.
     * @param {string} sectionKey - The type of render manager. Used to form event names.
     *
     * @constructor
     */
    constructor(eventBus: any, sectionKey: string);
    _eventBus: any;
    _sectionKey: string;
    isSectionRendered: boolean;
    /**
     * Attach the managed section to a parent node.
     *
     * @param {HTMLElement} container - The parent node to attach to.
     */
    attachTo(container: HTMLElement): void;
    /**
     * Detach the managed section from its parent node.
     */
    detach(): void;
    /**
     * Reset the managed section to its initial state.
     */
    reset(): void;
    /**
     * Circumvents timing issues.
     */
    _onceSectionRendered(callback: any): void;
}
