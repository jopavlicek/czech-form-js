import { simpleSelectEntryFactory } from './factories';

export function LayouterAppearanceEntry(props) {
  const {
    field
  } = props;

  if (![ 'group', 'dynamiclist' ].includes(field.type)) {
    return [];
  }

  const entries = [
    simpleSelectEntryFactory({
      id: 'verticalAlignment',
      path: [ 'verticalAlignment' ],
      label: 'Vertikální zarovnání',
      optionsArray: [
        { value: 'start', label: 'Horní okraj' },
        { value: 'center', label: 'Střed' },
        { value: 'end', label: 'Dolní okraj' }
      ],
      props
    }),
  ];

  return entries;
}