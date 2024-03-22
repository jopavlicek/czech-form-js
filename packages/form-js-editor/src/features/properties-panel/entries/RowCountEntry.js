import { NumberFieldEntry, isNumberFieldEntryEdited } from '@bpmn-io/properties-panel';

import { get, isNumber, isNil } from 'min-dash';

import { useService } from '../hooks';

const path = [ 'rowCount' ];

export function RowCountEntry(props) {
  const {
    editField,
    field
  } = props;

  const entries = [];

  entries.push({
    id: 'rowCount',
    component: RowCount,
    isEdited: isNumberFieldEntryEdited,
    editField,
    field,
    isDefaultVisible: (field) => field.type === 'table' && isNumber(get(field, path))
  });

  return entries;
}

function RowCount(props) {

  const {
    editField,
    field,
    id
  } = props;

  const debounce = useService('debounce');

  const getValue = () => get(field, path);

  /**
   * @param {number|void} value
   * @param {string|null} error
   * @returns {void}
   */
  const setValue = (value, error) => {
    if (error) {
      return;
    }

    editField(field, path, value);
  };

  return NumberFieldEntry({
    debounce,
    label: 'Počet řádků na stránce',
    element: field,
    id,
    getValue,
    setValue,
    validate
  });
}


// helpers //////////

/**
   * @param {string|void} value
   * @returns {string|null}
   */
const validate = (value) => {

  if (isNil(value)) {
    return null;
  }

  if (!isNumber(value)) {
    return 'Hodnota musí být číslo.';
  }

  if (!Number.isInteger(value)) {
    return 'Hodnota musí být platné celé číslo.';
  }

  if (value < 1) {
    return 'Hodnota musí být větší než 0.';
  }

  return null;
};