export function GeneralGroup(field: any, editField: any, getService: any): {
    id: string;
    label: string;
    entries: ({
        id: string;
        component: (props: any) => any;
        editField: any;
        field: any;
        isEdited: any;
    } | {
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
        id: any;
        label: any;
        path: any;
        field: any;
        editField: any;
        min: any;
        max: any;
        component: (props: any) => any;
        isEdited: any;
    })[];
};
