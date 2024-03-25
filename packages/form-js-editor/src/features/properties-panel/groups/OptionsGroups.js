import {
  OptionsSourceSelectEntry,
  StaticOptionsSourceEntry,
  InputKeyOptionsSourceEntry,
  OptionsExpressionEntry
} from '../entries';

import { getOptionsSource, OPTIONS_SOURCES } from '@bpmn-io/form-js-viewer';

import { Group, ListGroup } from '@bpmn-io/properties-panel';

import {
  OPTIONS_INPUTS,
  hasOptionsGroupsConfigured
} from '../Util';

export function OptionsGroups(field, editField, getService) {
  const {
    type
  } = field;

  const formFields = getService('formFields');

  const fieldDefinition = formFields.get(type).config;

  if (!OPTIONS_INPUTS.includes(type) && !hasOptionsGroupsConfigured(fieldDefinition)) {
    return [];
  }

  const context = { editField, field };
  const id = 'valuesSource';

  /**
   * @type {Array<Group|ListGroup>}
   */
  const groups = [
    {
      id,
      label: 'Zdroj možností',
      tooltip: getValuesTooltip(),
      component: Group,
      entries: OptionsSourceSelectEntry({ ...context, id })
    }
  ];

  const valuesSource = getOptionsSource(field);

  if (valuesSource === OPTIONS_SOURCES.INPUT) {
    const id = 'dynamicOptions';
    groups.push({
      id,
      label: 'Dynamické možnosti',
      component: Group,
      entries: InputKeyOptionsSourceEntry({ ...context, id })
    });
  } else if (valuesSource === OPTIONS_SOURCES.STATIC) {
    const id = 'staticOptions';
    groups.push({
      id,
      label: 'Statické možnosti',
      component: ListGroup,
      ...StaticOptionsSourceEntry({ ...context, id })
    });
  } else if (valuesSource === OPTIONS_SOURCES.EXPRESSION) {
    const id = 'optionsExpression';
    groups.push({
      id,
      label: 'Výraz s možnostmi',
      component: Group,
      entries: OptionsExpressionEntry({ ...context, id })
    });
  }

  return groups;
}

// helpers //////////

function getValuesTooltip() {
  return '"Staticky" - Možnosti existují ve formě předem definovaných konstant.\n\n' +
  '"Dynamicky" - Možnosti jsou načítány z proměnné schématu, kterou lze plnit na základě podmínek.\n\n' +
  '"Výraz" - Možnosti jsou načteny pomocí FEEL výrazu.';
}