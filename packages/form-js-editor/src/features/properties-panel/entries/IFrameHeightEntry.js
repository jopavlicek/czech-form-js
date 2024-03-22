import { HeightEntry } from './HeightEntry';

export function IFrameHeightEntry(props) {
  return [
    ...HeightEntry({
      ...props,
      description: 'Výška okna v pixelech.',
      isDefaultVisible: (field) => field.type === 'iframe'
    })
  ];
}