import { get } from 'min-dash';

import { useService, useVariables } from '../hooks';

import { FeelTemplatingEntry, isFeelEntryEdited } from '@bpmn-io/properties-panel';

const HTTPS_PATTERN = /^(https):\/\/*/i; // eslint-disable-line no-useless-escape


export function IFrameUrlEntry(props) {
  const {
    editField,
    field
  } = props;

  const entries = [];
  entries.push({
    id: 'url',
    component: Url,
    editField: editField,
    field: field,
    isEdited: isFeelEntryEdited,
    isDefaultVisible: (field) => field.type === 'iframe'
  });

  return entries;
}

function Url(props) {
  const {
    editField,
    field,
    id
  } = props;

  const debounce = useService('debounce');

  const variables = useVariables().map(name => ({ name }));

  const path = [ 'url' ];

  const getValue = () => {
    return get(field, path, '');
  };

  const setValue = (value) => {
    return editField(field, path, value);
  };

  return FeelTemplatingEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'URL',
    setValue,
    singleLine: true,
    tooltip: getTooltip(),
    validate,
    variables
  });
}

// helper //////////////////////

function getTooltip() {
  return (
    <>
      <p>
        Jako zdroj použijte HTTPS URL adresu, šablonu nebo výraz (pro předání hodnoty skrz proměnnou).
      </p>
      <p>
        Ujistěte se, že je URL adresa bezpečná, protože může představovat bezpečnostní riziko.
      </p>
      <p>
        Ne všechny externí zdroje mohou být zobrazeny skrz iFrame. Více informací najdete v <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options">dokumentaci X-FRAME-OPTIONS</a>.
      </p>
    </>
  );
}

/**
  * @param {string|void} value
  * @returns {string|null}
  */
const validate = (value) => {
  if (!value || value.startsWith('=')) {
    return;
  }

  if (!HTTPS_PATTERN.test(value)) {
    return 'Z bezpečnostních důvodů musí URL adresa začínat "https".';
  }
};