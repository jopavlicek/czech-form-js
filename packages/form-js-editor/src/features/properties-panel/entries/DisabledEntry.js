import { get } from 'min-dash';

import { INPUTS } from '../Util';

import { ToggleSwitchEntry, isToggleSwitchEntryEdited } from '@bpmn-io/properties-panel';


export function DisabledEntry(props) {
  const {
    editField,
    field
  } = props;

  const entries = [];

  entries.push({
    id: 'disabled',
    component: Disabled,
    editField: editField,
    field: field,
    isEdited: isToggleSwitchEntryEdited,
    isDefaultVisible: (field) => INPUTS.includes(field.type)
  });

  return entries;
}

function Disabled(props) {
  const {
    editField,
    field,
    id
  } = props;

  const path = [ 'disabled' ];

  const getValue = () => {
    return get(field, path, '');
  };

  const setValue = (value) => {
    return editField(field, path, value);
  };

  return ToggleSwitchEntry({
    element: field,
    getValue,
    id,
    label: 'Deaktivováno',
    tooltip: 'Obsah pole nelze upravit a data se neodešlou. Má přednost před volbou "pouze pro čtení".',
    inline: true,
    setValue
  });
}