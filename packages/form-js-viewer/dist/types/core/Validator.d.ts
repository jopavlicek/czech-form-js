export class Validator {
    constructor(expressionLanguage: any, conditionChecker: any, form: any);
    _expressionLanguage: any;
    _conditionChecker: any;
    _form: any;
    validateField(field: any, value: any): any[];
}
export namespace Validator {
    let $inject: string[];
}
