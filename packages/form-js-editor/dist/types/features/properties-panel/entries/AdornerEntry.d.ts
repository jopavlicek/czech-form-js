export function AdornerEntry(props: any): {
    id: string;
    component: typeof PrefixAdorner;
    isEdited: any;
    editField: any;
    field: any;
    onChange: (key: any) => (value: any) => void;
    getValue: (key: any) => () => any;
    isDefaultVisible: {};
}[];
declare function PrefixAdorner(props: any): any;
export {};
