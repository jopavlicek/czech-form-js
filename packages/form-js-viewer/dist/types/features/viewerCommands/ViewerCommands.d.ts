export class ViewerCommands {
    constructor(commandStack: any, eventBus: any);
    _commandStack: any;
    registerHandlers(): void;
    getHandlers(): {
        'formField.validation.update': typeof UpdateFieldValidationHandler;
    };
    updateFieldValidation(field: any, value: any, indexes: any): void;
}
export namespace ViewerCommands {
    let $inject: string[];
}
import { UpdateFieldValidationHandler } from './cmd/UpdateFieldValidationHandler';
