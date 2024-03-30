export namespace CoreModule {
    let __depends__: {
        __init__: string[];
        formFields: (string | typeof import("../render/EditorFormFields").EditorFormFields)[];
        renderer: (string | typeof import("../render/Renderer").Renderer)[];
    }[];
    let debounce: (string | typeof DebounceFactory)[];
    let eventBus: (string | typeof EventBus)[];
    let importer: (string | typeof Importer)[];
    let formFieldRegistry: (string | typeof FormFieldRegistry)[];
    let pathRegistry: (string | typeof PathRegistry)[];
    let formLayouter: (string | typeof FormLayouter)[];
    let formLayoutValidator: (string | typeof FormLayoutValidator)[];
    let fieldFactory: (string | typeof FieldFactory)[];
}
import { DebounceFactory } from './Debounce';
import { EventBus } from './EventBus';
import { Importer } from '@bpmn-io/form-js-viewer';
import { FormFieldRegistry } from './FormFieldRegistry';
import { PathRegistry } from '@bpmn-io/form-js-viewer';
import { FormLayouter } from './FormLayouter';
import { FormLayoutValidator } from './FormLayoutValidator';
import { FieldFactory } from '@bpmn-io/form-js-viewer';
