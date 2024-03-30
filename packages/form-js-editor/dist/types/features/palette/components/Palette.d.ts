export function Palette(props: any): import("preact").JSX.Element;
/**
 * Returns a list of palette entries.
 *
 * @param {FormFields} formFields
 * @returns {Array<PaletteEntry>}
 */
export function collectPaletteEntries(formFields: FormFields): Array<PaletteEntry>;
/**
 * There are various options to specify an icon for a palette entry.
 *
 * a) via `iconUrl` property in a form field config
 * b) via `icon` property in a form field config
 * c) via statically defined iconsByType (fallback)
 */
export function getPaletteIcon(entry: any): any;
/**
 * @typedef { import('@bpmn-io/form-js-viewer').FormFields } FormFields
 *
 * @typedef { {
 *  label: string,
 *  type: string,
 *  group: ('basic-input'|'selection'|'presentation'|'action'),
 *  icon: preact.FunctionalComponent,
 *  iconUrl: string
 * } } PaletteEntry
 */
export const PALETTE_GROUPS: {
    label: string;
    id: string;
}[];
export type FormFields = import('@bpmn-io/form-js-viewer').FormFields;
export type PaletteEntry = {
    label: string;
    type: string;
    group: ('basic-input' | 'selection' | 'presentation' | 'action');
    icon: preact.FunctionalComponent;
    iconUrl: string;
};
import { PaletteEntry } from './PaletteEntry';
