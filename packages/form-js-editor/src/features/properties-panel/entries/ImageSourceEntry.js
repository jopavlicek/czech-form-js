import { get } from 'min-dash';

import { useService, useVariables } from '../hooks';

import { FeelTemplatingEntry, isFeelEntryEdited } from '@bpmn-io/properties-panel';

export function ImageSourceEntry(props) {
  const {
    editField,
    field
  } = props;

  const entries = [];
  entries.push({
    id: 'source',
    component: Source,
    editField: editField,
    field: field,
    isEdited: isFeelEntryEdited,
    isDefaultVisible: (field) => field.type === 'image'
  });

  return entries;
}

function Source(props) {
  const {
    editField,
    field,
    id
  } = props;

  const debounce = useService('debounce');

  const variables = useVariables().map(name => ({ name }));

  const path = [ 'source' ];

  const getValue = () => {
    return get(field, path, '');
  };

  const setValue = (value) => {
    return editField(field, path, value);
  };

  return FeelTemplatingEntry({
    debounce,
    description: 'Výraz, URL odkaz, nebo datové URI',
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'Zdroj obrázku',
    tooltip: 'Jako zdroj lze použít URL odkaz nebo datové URI se zakódovaným obrázkem (např. ve formátu data:image/jpeg;base64,<zakódovaný obrázek>).',
    setValue,
    singleLine: true,
    variables
  });
}
