export namespace BehaviorModule {
    let __init__: string[];
    let idBehavior: (string | typeof IdBehavior)[];
    let keyBehavior: (string | typeof KeyBehavior)[];
    let pathBehavior: (string | typeof PathBehavior)[];
    let validateBehavior: (string | typeof ValidateBehavior)[];
    let optionsSourceBehavior: (string | typeof OptionsSourceBehavior)[];
    let columnsSourceBehavior: (string | typeof ColumnsSourceBehavior)[];
    let tableDataSourceBehavior: (string | typeof TableDataSourceBehavior)[];
}
import { IdBehavior } from './IdBehavior';
import { KeyBehavior } from './KeyBehavior';
import { PathBehavior } from './PathBehavior';
import { ValidateBehavior } from './ValidateBehavior';
import { OptionsSourceBehavior } from './OptionsSourceBehavior';
import { ColumnsSourceBehavior } from './ColumnsSourceBehavior';
import { TableDataSourceBehavior } from './TableDataSourceBehavior';
