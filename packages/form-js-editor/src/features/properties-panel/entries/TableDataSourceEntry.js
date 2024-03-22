import { get, isString } from 'min-dash';

import { hasIntegerPathSegment, isValidDotPath } from '../Util';

import { useService, useVariables } from '../hooks';

import { FeelTemplatingEntry, isFeelEntryEdited } from '@bpmn-io/properties-panel';

export function TableDataSourceEntry(props) {
  const {
    editField,
    field
  } = props;

  const entries = [];
  entries.push({
    id: 'dataSource',
    component: Source,
    editField: editField,
    field: field,
    isEdited: isFeelEntryEdited,
    isDefaultVisible: (field) => field.type === 'table'
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

  const path = [ 'dataSource' ];

  const getValue = () => {

    return get(field, path, field.id);
  };

  const setValue = (value, error) => {
    if (error) {
      return;
    }

    editField(field, path, value);
  };

  return FeelTemplatingEntry({
    debounce,
    description: 'Uveďte zdroj dat pro naplnění tabulky',
    element: field,
    feel: 'required',
    getValue,
    id,
    label: 'Zdroj dat',
    tooltip: 'Zadejte vstupní proměnnou formuláře, která obsahuje data pro tabulku, nebo definujte výraz pro dynamické naplnění.',
    setValue,
    singleLine: true,
    variables,
    validate,
  });
}


// helper ////////////////

/**
   * @param {string|void} value
   * @returns {string|null}
   */
const validate = (value) => {

  if (!isString(value) || value.length === 0) {
    return 'Must not be empty.';
  }

  if (value.startsWith('=')) {
    return null;
  }

  if (!isValidDotPath(value)) {
    return 'Must be a variable or a dot separated path.';
  }

  if (hasIntegerPathSegment(value)) {
    return 'Must not contain numerical path segments.';
  }

  return null;
};
