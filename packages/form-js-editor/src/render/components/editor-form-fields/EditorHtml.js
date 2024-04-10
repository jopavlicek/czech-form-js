import { Html } from '@bpmn-io/form-js-viewer';
import { editorFormFieldClasses } from '../Util';
import { useService } from '../../hooks';

import { iconsByType } from '../icons';

export function EditorHtml(props) {

  const { type, content = '' } = props.field;

  const Icon = iconsByType(type);

  const templating = useService('templating');
  const expressionLanguage = useService('expressionLanguage');

  if (!content || !content.trim()) {
    return <div class={ editorFormFieldClasses(type) }>
      <div class="fjs-form-field-placeholder"><Icon viewBox="0 0 54 54" />HTML obsah je prázdný</div>
    </div>;
  }

  if (expressionLanguage.isExpression(content)) {
    return <div class={ editorFormFieldClasses(type) }>
      <div class="fjs-form-field-placeholder"><Icon viewBox="0 0 54 54" />HTML obsah je zaplněn výrazem</div>
    </div>;
  }

  if (templating.isTemplate(content)) {
    return <div class={ editorFormFieldClasses(type) }>
      <div class="fjs-form-field-placeholder"><Icon viewBox="0 0 54 54" />HTML obsah je šablonován</div>
    </div>;
  }

  return <Html { ...{ ...props, disableLinks: true } } />;
}

EditorHtml.config = Html.config;
