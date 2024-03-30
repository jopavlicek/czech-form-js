/**
 * @typedef { import('./types').CreateFormEditorOptions } CreateFormEditorOptions
 */
/**
 * Create a form editor.
 *
 * @param {CreateFormEditorOptions} options
 *
 * @return {Promise<FormEditor>}
 */
export function createFormEditor(options: CreateFormEditorOptions): Promise<FormEditor>;
export type CreateFormEditorOptions = import('./types').CreateFormEditorOptions;
import { FormEditor } from './FormEditor';
import { schemaVersion } from '@bpmn-io/form-js-viewer';
export { FormEditor, schemaVersion };
export { useDebounce, usePrevious, useService } from "./render/hooks";
export { useService as usePropertiesPanelService, useVariables } from "./features/properties-panel/hooks";
