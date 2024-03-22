import { get } from 'min-dash';

import { SelectEntry, isSelectEntryEdited } from '@bpmn-io/properties-panel';


export function ActionEntry(props) {
  const {
    editField,
    field
  } = props;

  const entries = [];

  entries.push({
    id: 'action',
    component: Action,
    editField: editField,
    field: field,
    isEdited: isSelectEntryEdited,
    isDefaultVisible: (field) => field.type === 'button'
  });

  return entries;
}

function Action(props) {
  const {
    editField,
    field,
    id
  } = props;

  const path = [ 'action' ];

  const getValue = () => {
    return get(field, path, '');
  };

  const setValue = (value) => {
    return editField(field, path, value);
  };

  const getOptions = () => [
    {
      label: 'Odeslat',
      value: 'submit'
    },
    {
      label: 'Resetovat',
      value: 'reset'
    }
  ];

  return SelectEntry({
    element: field,
    getOptions,
    getValue,
    id,
    label: 'Akce',
    setValue
  });
}