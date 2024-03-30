export function CustomPropertiesGroup(field: any, editField: any): {
    add: (event: any) => void;
    component: any;
    id: string;
    items: {
        autoFocusEntry: string;
        entries: {
            component: (props: any) => any;
            editField: any;
            field: any;
            id: string;
            idPrefix: any;
            index: any;
            validateFactory: any;
        }[];
        id: string;
        label: string;
        remove: (event: any) => any;
    }[];
    label: string;
    tooltip: string;
    shouldSort: boolean;
};
/**
 * Returns copy of object without key.
 *
 * @param {Object} properties
 * @param {string} oldKey
 *
 * @returns {Object}
 */
export function removeKey(properties: any, oldKey: string): any;
