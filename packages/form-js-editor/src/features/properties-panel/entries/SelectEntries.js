
import { simpleBoolEntryFactory } from './factories';

export function SelectEntries(props) {
  const entries = [
    simpleBoolEntryFactory({
      id: 'searchable',
      path: [ 'searchable' ],
      label: 'Povolit vyhledávání',
      props,
      isDefaultVisible: (field) => field.type === 'select'
    })
  ];

  return entries;
}