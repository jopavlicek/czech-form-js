export function HtmlEntry(props: any): {
    id: string;
    component: typeof Content;
    editField: any;
    field: any;
    isEdited: any;
    isDefaultVisible: (field: any) => boolean;
}[];
declare function Content(props: any): any;
export {};
