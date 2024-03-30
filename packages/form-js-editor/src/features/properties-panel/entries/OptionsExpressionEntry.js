import { FeelEntry, isFeelEntryEdited } from '@bpmn-io/properties-panel';
import { get } from 'min-dash';
import { useService, useVariables } from '../hooks';
import { OPTIONS_SOURCES, OPTIONS_SOURCES_PATHS } from '@bpmn-io/form-js-viewer';

export function OptionsExpressionEntry(props) {
  const {
    editField,
    field,
    id
  } = props;

  return [
    {
      id: id + '-expression',
      component: OptionsExpression,
      isEdited: isFeelEntryEdited,
      editField,
      field
    }
  ];
}

function OptionsExpression(props) {
  const {
    editField,
    field,
    id
  } = props;

  const debounce = useService('debounce');

  const variables = useVariables().map(name => ({ name }));

  const path = OPTIONS_SOURCES_PATHS[OPTIONS_SOURCES.EXPRESSION];

  const schema = '[\n  {\n    "label": "dollar",\n    "value": "$"\n  }\n]';

  const tooltip = <div>
    Výsledek výrazu může být pole jednoduchých hodnot nebo musí podléhat následujícímu schématu:
    <pre><code>{schema}</code></pre>
  </div>;

  const getValue = () => get(field, path, '');

  const setValue = (value) => editField(field, path, value || '');

  return FeelEntry({
    debounce,
    description: 'Výraz, který naplní seznam možností.',
    tooltip,
    element: field,
    feel: 'required',
    getValue,
    id,
    label: 'Výraz',
    setValue,
    variables
  });
}
