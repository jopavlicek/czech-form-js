export function ValidationGroup(field: any, editField: any): {
    id: string;
    label: string;
    entries: {
        id: string;
        component: typeof Required;
        getValue: (key: any) => () => any;
        field: any;
        isEdited: any;
        onChange: (key: any) => (value: any) => void;
        isDefaultVisible: (field: any) => boolean;
    }[];
};
declare function Required(props: any): any;
export {};
