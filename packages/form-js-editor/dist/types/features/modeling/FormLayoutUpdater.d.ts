export class FormLayoutUpdater extends CommandInterceptor {
    constructor(eventBus: any, formLayouter: any, modeling: any, formEditor: any);
    _eventBus: any;
    _formLayouter: any;
    _modeling: any;
    _formEditor: any;
    updateLayout(schema: any): void;
    updateRowIds(event: any): void;
}
export namespace FormLayoutUpdater {
    let $inject: string[];
}
import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
