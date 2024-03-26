import { get, isArray } from 'min-dash';

import {
  ColumnsExpressionEntry,
  HeadersSourceSelectEntry,
  StaticColumnsSourceEntry
} from '../entries';

import { Group, ListGroup } from '@bpmn-io/properties-panel';

export function TableHeaderGroups(field, editField) {
  const {
    type,
    id: fieldId
  } = field;

  if (type !== 'table') {
    return [];
  }

  const areStaticColumnsEnabled = isArray(get(field, [ 'columns' ]));

  /**
    * @type {Array<Group>}
    */
  const groups = [
    {
      id: `${fieldId}-columnsSource`,
      label: 'Zdroj záhlaví',
      tooltip: TOOLTIP_TEXT,
      component: Group,
      entries: [
        ...HeadersSourceSelectEntry({ field, editField }),
        ...ColumnsExpressionEntry({ field, editField })
      ]
    }
  ];

  if (areStaticColumnsEnabled) {
    const id = `${fieldId}-columns`;

    groups.push({
      id,
      label: 'Položky záhlaví',
      component: ListGroup,
      ...StaticColumnsSourceEntry({ field, editField, id })
    });
  }

  return groups;
}

// helpers //////////

const TOOLTIP_TEXT = `"Seznam položek" - Záhlaví je naplněno z předem definovaných statických položek.

"Výraz" - Záhlaví je naplněno pomocí výsledku FEEL výrazu.
`;
