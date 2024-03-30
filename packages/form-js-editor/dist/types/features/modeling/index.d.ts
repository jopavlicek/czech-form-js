export namespace ModelingModule {
    let __depends__: (import("didi").ModuleDeclaration | {
        __init__: string[];
        idBehavior: (string | typeof import("./behavior/IdBehavior").IdBehavior)[];
        keyBehavior: (string | typeof import("./behavior/KeyBehavior").KeyBehavior)[];
        pathBehavior: (string | typeof import("./behavior/PathBehavior").PathBehavior)[];
        validateBehavior: (string | typeof import("./behavior/ValidateBehavior").ValidateBehavior)[];
        optionsSourceBehavior: (string | typeof import("./behavior/OptionsSourceBehavior").OptionsSourceBehavior)[];
        columnsSourceBehavior: (string | typeof import("./behavior/ColumnsSourceBehavior").ColumnsSourceBehavior)[];
        tableDataSourceBehavior: (string | typeof import("./behavior/TableDataSourceBehavior").TableDataSourceBehavior)[];
    })[];
    let __init__: string[];
    let formLayoutUpdater: (string | typeof FormLayoutUpdater)[];
    let modeling: (string | typeof Modeling)[];
}
import { FormLayoutUpdater } from './FormLayoutUpdater';
import { Modeling } from './Modeling';
