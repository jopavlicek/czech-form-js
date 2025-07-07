import { formFieldClasses } from '../Util';

const type = 'separator';

export function Separator() {
  return (
    <div class={formFieldClasses(type)}>
      <hr />
    </div>
  );
}

Separator.config = {
  type,
  keyed: false,
  name: 'Oddělovač',
  group: 'presentation',
  create: (options = {}) => ({
    ...options,
  }),
};
