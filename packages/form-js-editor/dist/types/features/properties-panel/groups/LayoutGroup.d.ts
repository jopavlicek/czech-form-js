export function LayoutGroup(field: any, editField: any): {
    id: string;
    label: string;
    entries: {
        id: string;
        component: (props: any) => any;
        field: any;
        editField: any;
        isEdited: any;
    }[];
};
