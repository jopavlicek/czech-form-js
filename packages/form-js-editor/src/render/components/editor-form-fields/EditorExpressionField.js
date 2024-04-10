import { ExpressionField, iconsByType } from '@bpmn-io/form-js-viewer';
import { editorFormFieldClasses } from '../Util';
import { useService } from '../../hooks';

const type = 'expression';

export function EditorExpressionField(props) {
  const { field } = props;
  const { expression = '', key } = field;

  const Icon = iconsByType('expression');
  const expressionLanguage = useService('expressionLanguage');

  let placeholderContent = 'Prázdný výraz';

  if (expression.trim() && expressionLanguage.isExpression(expression)) {
    placeholderContent = `Výraz pro '${key}'`;
  }

  return (
    <div class={ editorFormFieldClasses(type) }>
      <div class="fjs-form-field-placeholder">
        <Icon viewBox="0 0 54 54" />{placeholderContent}
      </div>
    </div>
  );
}

EditorExpressionField.config = {
  ...ExpressionField.config,
  escapeGridRender: false
};
