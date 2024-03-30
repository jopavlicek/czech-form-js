export class PropertiesProvider {
    constructor(propertiesPanel: any, injector: any);
    _injector: any;
    _filterVisibleEntries(groups: any, field: any, getService: any): any;
    getGroups(field: any, editField: any): (groups: any) => any;
}
export namespace PropertiesProvider {
    let $inject: string[];
}
