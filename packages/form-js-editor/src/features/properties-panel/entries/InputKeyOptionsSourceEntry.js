import { TextFieldEntry, isTextFieldEntryEdited } from '@bpmn-io/properties-panel';
import { get } from 'min-dash';
import { useService } from '../hooks';
import { OPTIONS_SOURCES, OPTIONS_SOURCES_PATHS } from '@bpmn-io/form-js-viewer';


export function InputKeyOptionsSourceEntry(props) {
  const {
    editField,
    field,
    id
  } = props;

  return [
    {
      id: id + '-key',
      component: InputValuesKey,
      isEdited: isTextFieldEntryEdited,
      editField,
      field,
    }
  ];
}

function InputValuesKey(props) {
  const {
    editField,
    field,
    id
  } = props;

  const debounce = useService('debounce');

  const path = OPTIONS_SOURCES_PATHS[OPTIONS_SOURCES.INPUT];

  const schema = '[\n  {\n    "label": "dollar",\n    "value": "$"\n  }\n]';

  const tooltip = <div>
    Vstup může být pole jednoduchých hodnot nebo musí podléhat následujícímu schématu:
    <pre><code>{schema}</code></pre>
  </div>;

  const getValue = () => get(field, path, '');

  const setValue = (value, error) => {
    if (error) {
      return;
    }

    editField(field, path, value || '');
  };

  return TextFieldEntry({
    debounce,
    description: 'Klíč ze schématu formuláře obsahující možnosti.',
    tooltip,
    element: field,
    getValue,
    id,
    label: 'Klíč vstupních hodnot',
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
  if (typeof value !== 'string' || value.length === 0) {
    return 'Hodnota nesmí být prázdná.';
  }

  if (/\s/.test(value)) {
    return 'Hodnota nesmí obsahovat mezery.';
  }

  return null;
};
