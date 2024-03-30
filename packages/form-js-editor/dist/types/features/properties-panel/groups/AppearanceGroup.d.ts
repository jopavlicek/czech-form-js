export function AppearanceGroup(field: any, editField: any, getService: any): {
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
        id: any;
        label: any;
        path: any;
        field: any;
        editField: any;
        optionsArray: any;
        component: (props: any) => any;
        isEdited: any;
    } | {
        id: string;
        component: (props: any) => any;
        isEdited: any;
        editField: any;
        field: any;
        onChange: (key: any) => (value: any) => void;
        getValue: (key: any) => () => any;
        isDefaultVisible: {};
    })[];
};
