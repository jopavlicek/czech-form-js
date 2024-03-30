export function SecurityAttributesGroup(field: any, editField: any): {
    id: string;
    label: string;
    entries: ({
        id: any;
        label: any;
        path: any;
        field: any;
        editField: any;
        description: any;
        component: (props: any) => any;
        isEdited: any;
        isDefaultVisible: any;
        getValue: any;
        setValue: any;
    } | {
        component: (props: any) => import("preact").JSX.Element;
    })[];
    tooltip: import("preact").JSX.Element;
};
