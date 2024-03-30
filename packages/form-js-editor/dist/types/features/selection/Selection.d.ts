export class Selection {
    constructor(eventBus: any);
    _eventBus: any;
    _selection: any;
    get(): any;
    set(selection: any): void;
    toggle(selection: any): void;
    clear(): void;
    isSelected(formField: any): boolean;
}
export namespace Selection {
    let $inject: string[];
}
