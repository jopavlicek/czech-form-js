import { simpleRangeIntegerEntryFactory, simpleBoolEntryFactory } from './factories';

export function RepeatableEntry(props) {
  const {
    field,
    getService
  } = props;

  const {
    type
  } = field;

  const formFieldDefinition = getService('formFields').get(type);

  if (!formFieldDefinition || !formFieldDefinition.config.repeatable) {
    return [];
  }

  const entries = [
    simpleRangeIntegerEntryFactory({
      id: 'defaultRepetitions',
      path: [ 'defaultRepetitions' ],
      label: 'Výchozí počet položek',
      min: 1,
      max: 20,
      props
    }),
    simpleBoolEntryFactory({
      id: 'allowAddRemove',
      path: [ 'allowAddRemove' ],
      label: 'Povolit přidání/mazání',
      props
    }),
    simpleBoolEntryFactory({
      id: 'disableCollapse',
      path: [ 'disableCollapse' ],
      label: 'Zakázat sbalení seznamu',
      props
    })
  ];

  if (!field.disableCollapse) {
    const nonCollapseItemsEntry = simpleRangeIntegerEntryFactory({
      id: 'nonCollapsedItems',
      path: [ 'nonCollapsedItems' ],
      label: 'Počet rozbalených položek',
      min: 1,
      defaultValue: 5,
      props
    });

    entries.push(nonCollapseItemsEntry);
  }

  return entries;
}