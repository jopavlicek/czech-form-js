import { get, set } from 'min-dash';

import { simpleBoolEntryFactory } from '../entries/factories';

import { SECURITY_ATTRIBUTES_DEFINITIONS } from '@bpmn-io/form-js-viewer';


export function SecurityAttributesGroup(field, editField) {

  const {
    type
  } = field;

  if (type !== 'iframe') {
    return null;
  }

  const entries = createEntries({ field, editField });

  if (!entries.length) {
    return null;
  }

  return {
    id: 'securityAttributes',
    label: 'Zabezpečení',
    entries,
    tooltip: getTooltip()
  };
}

function createEntries(props) {
  const {
    editField,
    field
  } = props;

  const securityEntries = SECURITY_ATTRIBUTES_DEFINITIONS.map((definition) => {
    const {
      label,
      property
    } = definition;

    return simpleBoolEntryFactory({
      id: property,
      label: label,
      isDefaultVisible: (field) => field.type === 'iframe',
      path: [ 'security', property ],
      props,
      getValue: () => get(field, [ 'security', property ]),
      setValue: (value) => {
        const security = get(field, [ 'security' ], {});
        editField(field, [ 'security' ], set(security, [ property ], value));
      }
    });
  });

  return [
    { component: Advisory },
    ...securityEntries
  ];

}

const Advisory = (props) => {
  return <div class="bio-properties-panel-description fjs-properties-panel-detached-description">Tyto možnosti mohou představovat bezpečnostní rizika, zejména pokud se používají v kombinaci s dynamickými odkazy. Ujistěte se, že o nich víte, že důvěřujete zdrojové adrese URL a povolíte pouze to, co váš případ použití vyžaduje.</div>;
};

// helpers //////////

function getTooltip() {
  return <>
    <p>Povolte prvku iFrame přístup k dalším funkcím vašeho prohlížeče. Podrobnosti týkající se různých možností naleznete v <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe">MDN dokumentaci iFrame.</a></p>
  </>;
}