import Ids from 'ids';
import { isString, get, isNil, isObject, some, isNumber, set, findIndex, isArray, isDefined, values, uniqueBy, isFunction, bind, assign, groupBy, isUndefined } from 'min-dash';
import Big from 'big.js';
import classNames from 'classnames';
import { jsx, jsxs, Fragment } from 'preact/jsx-runtime';
import { useContext, useMemo, useRef, useCallback, useEffect, useState, useLayoutEffect } from 'preact/hooks';
import { createContext, createElement, Fragment as Fragment$1, render } from 'preact';
import isEqual from 'lodash/isEqual';
import flatpickr from 'flatpickr';
import * as React from 'preact/compat';
import { createPortal } from 'preact/compat';
import { Czech } from 'flatpickr/dist/l10n/cs.js';
import DOMPurify from 'dompurify';
import { Injector } from 'didi';
import { parseExpression, parseUnaryTests, evaluate, unaryTest } from 'feelin';
import { evaluate as evaluate$1, parser, buildSimpleTree } from 'feelers';
import { marked } from 'marked';

const getFlavouredFeelVariableNames = (feelString, feelFlavour = 'expression', options = {}) => {
  const {
    depth = 0,
    specialDepthAccessors = {}
  } = options;
  if (!['expression', 'unaryTest'].includes(feelFlavour)) return [];
  const tree = feelFlavour === 'expression' ? parseExpression(feelString) : parseUnaryTests(feelString);
  const simpleExpressionTree = _buildSimpleFeelStructureTree(tree, feelString);
  const variables = function _unfoldVariables(node) {
    if (node.name === 'PathExpression') {
      // if the path is built on top of a context, we process that context and
      // ignore the rest of the path expression, as it is not relevant for variable extraction
      const pathRoot = _linearizePathExpression(node)[0];
      if (pathRoot.name === 'Context') {
        return _unfoldVariables(pathRoot);
      }
      if (Object.keys(specialDepthAccessors).length === 0) {
        return depth === 0 ? [_getVariableNameAtPathIndex(node, 0)] : [];
      }

      // if using special depth accessors, use a more complex extraction
      return Array.from(_smartExtractVariableNames(node, depth, specialDepthAccessors));
    }
    if (depth === 0 && node.name === 'VariableName') return [node.variableName];

    // for any other kind of node, traverse its children and flatten the result
    if (node.children) {
      const variables = node.children.reduce((acc, child) => {
        return acc.concat(_unfoldVariables(child));
      }, []);

      // if we are within a filter context, we need to remove the item variable as it is used for iteration there
      return node.name === 'FilterContext' ? variables.filter(name => name !== 'item') : variables;
    }
    return [];
  }(simpleExpressionTree);
  return [...new Set(variables)];
};

/**
 * Get the variable name at the specified index in a given path expression.
 *
 * @param {Object} root - The root node of the path expression tree.
 * @param {number} index - The index of the variable name to retrieve.
 * @returns {string|null} The variable name at the specified index or null if index is out of bounds.
 */
const _getVariableNameAtPathIndex = (root, index) => {
  const nodes = _linearizePathExpression(root);
  return nodes[index].variableName || null;
};

/**
 * Extracts the variables which are required of the external context for a given path expression.
 * This is done by traversing the path expression tree and keeping track of the current depth relative to the external context.
 *
 * @param {Object} node - The root node of the path expression tree.
 * @param {number} initialDepth - The depth at which the root node is located in the outer context.
 * @param {Object} specialDepthAccessors - Definitions of special keywords which represent more complex accesses of the outer context.
 * @returns {Set} - A set containing the extracted variable names.
 */
const _smartExtractVariableNames = (node, initialDepth, specialDepthAccessors) => {
  // depth info represents the previous (initialised as null) and current depth of the current accessor in the path expression
  // we track multiple of these to account for the fact that a path expression may be ambiguous due to special keywords
  let accessorDepthInfos = [{
    previous: null,
    current: initialDepth - 1
  }];
  const extractedVariables = new Set();
  const pathNodes = _linearizePathExpression(node);
  for (let i = 0; i < pathNodes.length; i++) {
    const currentAccessor = pathNodes[i].variableName;
    if (currentAccessor in specialDepthAccessors) {
      const depthOffsets = specialDepthAccessors[currentAccessor];

      // if the current accessor is a special keyword, we need to expand the current depth info set
      // this is done to account for the ambiguity of keywords like parent, which may be used to access
      // the parent of the current node, or a child variable of the same name
      accessorDepthInfos = depthOffsets.reduce((accumulator, offset) => {
        return [...accumulator, ...accessorDepthInfos.map(depthInfo => ({
          previous: depthInfo.current,
          current: depthInfo.current + offset
        }))];
      }, []).filter(depthInfo => depthInfo.current >= -1); // discard all depth infos which are out of bounds
    } else {
      // if the current accessor is not a special keyword, we know it's simply accessing a child
      // hence we are now one level deeper in the tree and simply increment
      accessorDepthInfos = accessorDepthInfos.map(depthInfo => ({
        previous: depthInfo.current,
        current: depthInfo.current + 1
      }));
    }

    // finally, we check if for the current accessor, there is a scenario where:
    // previous it was at depth -1 (i.e. the root context), and is now at depth 0 (i.e. a variable)
    // these are the variables we need to request, so we add them to the set
    if (accessorDepthInfos.some(depthInfo => depthInfo.previous === -1 && depthInfo.current === 0)) {
      extractedVariables.add(currentAccessor);
    }
  }

  // we return a set to avoid duplicates
  return new Set(extractedVariables);
};

/**
 * Deconstructs a path expression tree into an array of components.
 *
 * @param {Object} root - The root node of the path expression tree.
 * @returns {Array<object>} An array of components in the path expression, in the correct order.
 */
const _linearizePathExpression = root => {
  let node = root;
  let parts = [];

  // Traverse the tree and collect path components
  while (node.name === 'PathExpression') {
    parts.push(node.children[1]);
    node = node.children[0];
  }

  // Add the last component to the array
  parts.push(node);

  // Reverse and return the array to get the correct order
  return parts.reverse();
};

/**
 * Builds a simplified feel structure tree from the given parse tree and feel string.
 * The nodes follow this structure: `{ name: string, children: Array, variableName?: string }`
 *
 * @param {Object} parseTree - The parse tree generated by a parser.
 * @param {string} feelString - The feel string used for parsing.
 * @returns {Object} The simplified feel structure tree.
 */
const _buildSimpleFeelStructureTree = (parseTree, feelString) => {
  const stack = [{
    children: []
  }];
  parseTree.iterate({
    enter: node => {
      const nodeRepresentation = {
        name: node.type.name,
        children: []
      };
      if (node.type.name === 'VariableName') {
        nodeRepresentation.variableName = feelString.slice(node.from, node.to);
      }
      stack.push(nodeRepresentation);
    },
    leave: () => {
      const result = stack.pop();
      const parent = stack[stack.length - 1];
      parent.children.push(result);
    }
  });
  return _extractFilterExpressions(stack[0].children[0]);
};

/**
 * Restructure the tree in such a way to bring filters (which create new contexts) to the root of the tree.
 * This is done to simplify the extraction of variables and match the context hierarchy.
 */
const _extractFilterExpressions = tree => {
  const flattenedExpressionTree = {
    name: 'Root',
    children: [tree]
  };
  const iterate = node => {
    if (node.children) {
      for (let x = 0; x < node.children.length; x++) {
        if (node.children[x].name === 'FilterExpression') {
          const filterTarget = node.children[x].children[0];
          const filterExpression = node.children[x].children[2];

          // bypass the filter expression
          node.children[x] = filterTarget;
          const taggedFilterExpression = {
            name: 'FilterContext',
            children: [filterExpression]
          };

          // append the filter expression to the root
          flattenedExpressionTree.children.push(taggedFilterExpression);

          // recursively iterate the expression
          iterate(filterExpression);
        } else {
          iterate(node.children[x]);
        }
      }
    }
  };
  iterate(tree);
  return flattenedExpressionTree;
};

class FeelExpressionLanguage {
  constructor(eventBus) {
    this._eventBus = eventBus;
  }

  /**
   * Determines if the given value is a FEEL expression.
   *
   * @param {any} value
   * @returns {boolean}
   *
   */
  isExpression(value) {
    return isString(value) && value.startsWith('=');
  }

  /**
   * Retrieve variable names from a given FEEL expression.
   *
   * @param {string} expression
   * @param {object} [options]
   * @param {string} [options.type]
   *
   * @returns {string[]}
   */
  getVariableNames(expression, options = {}) {
    const {
      type = 'expression'
    } = options;
    if (!this.isExpression(expression)) {
      return [];
    }
    if (!['unaryTest', 'expression'].includes(type)) {
      throw new Error('Unknown expression type: ' + type);
    }
    return getFlavouredFeelVariableNames(expression, type);
  }

  /**
   * Evaluate an expression.
   *
   * @param {string} expression
   * @param {import('../../types').Data} [data]
   *
   * @returns {any}
   */
  evaluate(expression, data = {}) {
    if (!expression) {
      return null;
    }
    if (!isString(expression) || !expression.startsWith('=')) {
      return null;
    }
    try {
      const result = evaluate(expression.slice(1), data);
      return result;
    } catch (error) {
      this._eventBus.fire('error', {
        error
      });
      return null;
    }
  }
}
FeelExpressionLanguage.$inject = ['eventBus'];

class FeelersTemplating {
  constructor() {}

  /**
   * Determines if the given value is a feelers template.
   *
   * @param {any} value
   * @returns {boolean}
   *
   */
  isTemplate(value) {
    return isString(value) && (value.startsWith('=') || /{{.*?}}/.test(value));
  }

  /**
   * Retrieve variable names from a given feelers template.
   *
   * @param {string} template
   *
   * @returns {string[]}
   */
  getVariableNames(template) {
    if (!this.isTemplate(template)) {
      return [];
    }
    const expressions = this._extractExpressionsWithDepth(template);

    // defines special accessors, and the change(s) in depth they could imply (e.g. parent can be used to access the parent context (depth - 1) or a child variable named parent (depth + 1)
    const specialDepthAccessors = {
      parent: [-1, 1],
      _parent_: [-1],
      this: [0, 1],
      _this_: [0]
    };
    return expressions.reduce((variables, {
      expression,
      depth
    }) => {
      return variables.concat(getFlavouredFeelVariableNames(expression, 'expression', {
        depth,
        specialDepthAccessors
      }));
    }, []);
  }

  /**
   * Evaluate a template.
   *
   * @param {string} template
   * @param {Object<string, any>} context
   * @param {Object} options
   * @param {boolean} [options.debug = false]
   * @param {boolean} [options.strict = false]
   * @param {Function} [options.buildDebugString]
   * @param {Function} [options.sanitizer]
   *
   * @returns
   */
  evaluate(template, context = {}, options = {}) {
    const {
      debug = false,
      strict = false,
      buildDebugString = err => ' {{⚠}} ',
      sanitizer = value => value
    } = options;
    return evaluate$1(template, context, {
      debug,
      strict,
      buildDebugString,
      sanitizer
    });
  }

  /**
  * @typedef {Object} ExpressionWithDepth
  * @property {number} depth - The depth of the expression in the syntax tree.
  * @property {string} expression - The extracted expression
  */

  /**
  * Extracts all feel expressions in the template along with their depth in the syntax tree.
  * The depth is incremented for child expressions of loops to account for context drilling.
  * @name extractExpressionsWithDepth
  * @param {string} template - A feelers template string.
  * @returns {Array<ExpressionWithDepth>} An array of objects, each containing the depth and the extracted expression.
  *
  * @example
  * const template = "Hello {{user}}, you have:{{#loop items}}\n- {{amount}} {{name}}{{/loop}}.";
  * const extractedExpressions = _extractExpressionsWithDepth(template);
  */
  _extractExpressionsWithDepth(template) {
    // build simplified feelers syntax tree
    const parseTree = parser.parse(template);
    const tree = buildSimpleTree(parseTree, template);
    return function _traverse(n, depth = 0) {
      if (['Feel', 'FeelBlock'].includes(n.name)) {
        return [{
          depth,
          expression: n.content
        }];
      }
      if (n.name === 'LoopSpanner') {
        const loopExpression = n.children[0].content;
        const childResults = n.children.slice(1).reduce((acc, child) => {
          return acc.concat(_traverse(child, depth + 1));
        }, []);
        return [{
          depth,
          expression: loopExpression
        }, ...childResults];
      }
      return n.children.reduce((acc, child) => {
        return acc.concat(_traverse(child, depth));
      }, []);
    }(tree);
  }
}
FeelersTemplating.$inject = [];

// config  ///////////////////

const MINUTES_IN_DAY = 60 * 24;
const DATETIME_SUBTYPES = {
  DATE: 'date',
  TIME: 'time',
  DATETIME: 'datetime'
};
const TIME_SERIALISING_FORMATS = {
  UTC_OFFSET: 'utc_offset',
  UTC_NORMALIZED: 'utc_normalized',
  NO_TIMEZONE: 'no_timezone'
};
const DATETIME_SUBTYPES_LABELS = {
  [DATETIME_SUBTYPES.DATE]: 'Datum',
  [DATETIME_SUBTYPES.TIME]: 'Čas',
  [DATETIME_SUBTYPES.DATETIME]: 'Datum a čas'
};
const TIME_SERIALISINGFORMAT_LABELS = {
  [TIME_SERIALISING_FORMATS.UTC_OFFSET]: 'Posun UTC',
  [TIME_SERIALISING_FORMATS.UTC_NORMALIZED]: 'Normalizované UTC',
  [TIME_SERIALISING_FORMATS.NO_TIMEZONE]: 'Bez časové zóny'
};
const DATETIME_SUBTYPE_PATH = ['subtype'];
const DATE_LABEL_PATH = ['dateLabel'];
const DATE_DISALLOW_PAST_PATH = ['disallowPassedDates'];
const TIME_LABEL_PATH = ['timeLabel'];
const TIME_USE24H_PATH = ['use24h'];
const TIME_INTERVAL_PATH = ['timeInterval'];
const TIME_SERIALISING_FORMAT_PATH = ['timeSerializingFormat'];

// config  ///////////////////

const OPTIONS_SOURCES = {
  STATIC: 'static',
  INPUT: 'input',
  EXPRESSION: 'expression'
};
const OPTIONS_SOURCE_DEFAULT = OPTIONS_SOURCES.STATIC;
const OPTIONS_SOURCES_LABELS = {
  [OPTIONS_SOURCES.STATIC]: 'Staticky',
  [OPTIONS_SOURCES.INPUT]: 'Dynamicky',
  [OPTIONS_SOURCES.EXPRESSION]: 'Výraz'
};
const OPTIONS_SOURCES_PATHS = {
  [OPTIONS_SOURCES.STATIC]: ['values'],
  [OPTIONS_SOURCES.INPUT]: ['valuesKey'],
  [OPTIONS_SOURCES.EXPRESSION]: ['valuesExpression']
};
const OPTIONS_SOURCES_DEFAULTS = {
  [OPTIONS_SOURCES.STATIC]: [{
    label: 'Možnost',
    value: 'moznost'
  }],
  [OPTIONS_SOURCES.INPUT]: '',
  [OPTIONS_SOURCES.EXPRESSION]: '='
};

// helpers ///////////////////

function getOptionsSource(field) {
  for (const source of Object.values(OPTIONS_SOURCES)) {
    if (get(field, OPTIONS_SOURCES_PATHS[source]) !== undefined) {
      return source;
    }
  }
  return OPTIONS_SOURCE_DEFAULT;
}

const SANDBOX_ATTRIBUTE = 'sandbox';
const ALLOW_ATTRIBUTE = 'allow';

// Cf. https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy#iframe_syntax
const SECURITY_ATTRIBUTES_DEFINITIONS = [{
  attribute: SANDBOX_ATTRIBUTE,
  directive: 'allow-scripts',
  property: 'allowScripts',
  label: 'Spouštění skriptů'
}, {
  attribute: SANDBOX_ATTRIBUTE,
  directive: 'allow-same-origin',
  property: 'allowSameOrigin',
  label: 'Povolit stejný původ'
}, {
  attribute: ALLOW_ATTRIBUTE,
  directive: 'fullscreen',
  property: 'fullscreen',
  label: 'Otevřít na celé obrazovce'
}, {
  attribute: ALLOW_ATTRIBUTE,
  directive: 'geolocation',
  property: 'geolocation',
  label: 'Geolokační služby'
}, {
  attribute: ALLOW_ATTRIBUTE,
  directive: 'camera',
  property: 'camera',
  label: 'Přístup ke kaměře'
}, {
  attribute: ALLOW_ATTRIBUTE,
  directive: 'microphone',
  property: 'microphone',
  label: 'Přístup k mikrofonu'
}, {
  attribute: SANDBOX_ATTRIBUTE,
  directive: 'allow-forms',
  property: 'allowForms',
  label: 'Odesílání formulářů'
}, {
  attribute: SANDBOX_ATTRIBUTE,
  directive: 'allow-modals',
  property: 'allowModals',
  label: 'Otevírat modální okna'
}, {
  attribute: SANDBOX_ATTRIBUTE,
  directive: 'allow-popups',
  property: 'allowPopups',
  label: 'Otevírat vyskakovací okna'
}, {
  attribute: SANDBOX_ATTRIBUTE,
  directive: 'allow-top-navigation',
  property: 'allowTopNavigation',
  label: 'Top-level navigace'
}, {
  attribute: SANDBOX_ATTRIBUTE,
  directive: 'allow-storage-access-by-user-activation',
  property: 'allowStorageAccessByUserActivation',
  label: 'Přístup k úložišti uživatelem'
}];

function createInjector(bootstrapModules) {
  const injector = new Injector(bootstrapModules);
  injector.init();
  return injector;
}

/**
 * @param {string?} prefix
 *
 * @returns Element
 */
function createFormContainer(prefix = 'fjs') {
  const container = document.createElement('div');
  container.classList.add(`${prefix}-container`);
  return container;
}

function formFieldClasses(type, {
  errors = [],
  disabled = false,
  readonly = false
} = {}) {
  if (!type) {
    throw new Error('type required');
  }
  return classNames('fjs-form-field', `fjs-form-field-${type}`, {
    'fjs-has-errors': errors.length > 0,
    'fjs-disabled': disabled,
    'fjs-readonly': readonly
  });
}
function gridColumnClasses(formField) {
  const {
    layout = {}
  } = formField;
  const {
    columns
  } = layout;
  return classNames('fjs-layout-column', `cds--col${columns ? '-lg-' + columns : ''}`,
  // always fall back to top-down on smallest screens
  'cds--col-sm-16', 'cds--col-md-16');
}
function prefixId(id, formId, indexes) {
  let result = 'fjs-form';
  if (formId) {
    result += `-${formId}`;
  }
  result += `-${id}`;
  Object.values(indexes || {}).forEach(index => {
    result += `_${index}`;
  });
  return result;
}

const type$h = 'button';
function Button(props) {
  const {
    disabled,
    onFocus,
    onBlur,
    field
  } = props;
  const {
    action = 'submit'
  } = field;
  return jsx("div", {
    class: formFieldClasses(type$h),
    children: jsx("button", {
      class: "fjs-button",
      type: action,
      disabled: disabled,
      onFocus: () => onFocus && onFocus(),
      onBlur: () => onBlur && onBlur(),
      children: field.label
    })
  });
}
Button.config = {
  type: type$h,
  keyed: false,
  label: 'Tlačítko',
  group: 'action',
  create: (options = {}) => ({
    action: 'submit',
    ...options
  })
};

const FormRenderContext = createContext({
  Empty: props => {
    return null;
  },
  Hidden: props => {
    return null;
  },
  Children: props => {
    return jsx("div", {
      class: props.class,
      style: props.style,
      children: props.children
    });
  },
  Element: props => {
    return jsx("div", {
      class: props.class,
      style: props.style,
      children: props.children
    });
  },
  Row: props => {
    return jsx("div", {
      class: props.class,
      style: props.style,
      children: props.children
    });
  },
  Column: props => {
    if (props.field.type === 'default') {
      return props.children;
    }
    return jsx("div", {
      class: props.class,
      style: props.style,
      children: props.children
    });
  },
  hoverInfo: {
    cleanup: () => {}
  }
});

const LocalExpressionContext = createContext({
  data: null,
  this: null,
  parent: null,
  i: null
});

/**
 * @param {string} type
 * @param {boolean} [strict]
 *
 * @returns {any}
 */
function getService(type, strict) {}
const FormContext = createContext({
  getService,
  formId: null
});

function useService(type, strict) {
  const {
    getService
  } = useContext(FormContext);
  return getService(type, strict);
}

function isRequired(field) {
  return field.required;
}
function pathParse(path) {
  if (!path) {
    return [];
  }
  return path.split('.').map(key => {
    return isNaN(parseInt(key)) ? key : parseInt(key);
  });
}
function pathsEqual(a, b) {
  return a && b && a.length === b.length && a.every((value, index) => value === b[index]);
}
const indices = {};
function generateIndexForType(type) {
  if (type in indices) {
    indices[type]++;
  } else {
    indices[type] = 1;
  }
  return indices[type];
}
function generateIdForType(type) {
  return `${type}${generateIndexForType(type)}`;
}

/**
 * @template T
 * @param {T} data
 * @param {(this: any, key: string, value: any) => any} [replacer]
 * @return {T}
 */
function clone(data, replacer) {
  return JSON.parse(JSON.stringify(data, replacer));
}

/**
 * Transform a LocalExpressionContext object into a usable FEEL context.
 *
 * @param {Object} context - The LocalExpressionContext object.
 * @returns {Object} The usable FEEL context.
 */

function buildExpressionContext(context) {
  const {
    data,
    ...specialContextKeys
  } = context;
  return {
    ...specialContextKeys,
    ...data,
    ..._wrapObjectKeysWithUnderscores(specialContextKeys)
  };
}
function runRecursively(formField, fn) {
  const components = formField.components || [];
  components.forEach((component, index) => {
    runRecursively(component, fn);
  });
  fn(formField);
}

// helpers //////////////////////

function _wrapObjectKeysWithUnderscores(obj) {
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    newObj[`_${key}_`] = value;
  }
  return newObj;
}

/**
 * Evaluate if condition is met reactively based on the conditionChecker and form data.
 *
 * @param {string | undefined} condition
 *
 * @returns {boolean} true if condition is met or no condition or condition checker exists
 */
function useCondition(condition) {
  const conditionChecker = useService('conditionChecker', false);
  const expressionContextInfo = useContext(LocalExpressionContext);
  return useMemo(() => {
    return conditionChecker ? conditionChecker.check(condition, buildExpressionContext(expressionContextInfo)) : null;
  }, [conditionChecker, condition, expressionContextInfo]);
}

/**
 * Returns the options data for the provided if they can be simply determined, ignoring expression defined options.
 *
 * @param {object} formField
 * @param {object} formData
 */
function getSimpleOptionsData(formField, formData) {
  const {
    valuesExpression: optionsExpression,
    valuesKey: optionsKey,
    values: staticOptions
  } = formField;
  if (optionsExpression) {
    return null;
  }
  return optionsKey ? get(formData, [optionsKey]) : staticOptions;
}

/**
 * Normalizes the provided options data to a format that can be used by the select components.
 * If the options data is not valid, it is filtered out.
 *
 * @param {any[]} optionsData
 *
 * @returns {object[]}
 */
function normalizeOptionsData(optionsData) {
  return optionsData.filter(_isAllowedValue).map(_normalizeOption).filter(o => !isNil(o));
}

/**
 * Creates an options object with default values if no options are provided.
 *
 * @param {object} options
 *
 * @returns {object}
 */
function createEmptyOptions(options = {}) {
  const defaults = {};

  // provide default options if valuesKey and valuesExpression are not set
  if (!options.valuesKey && !options.valuesExpression) {
    defaults.values = [{
      label: 'Možnost',
      value: 'moznost'
    }];
  }
  return {
    ...defaults,
    ...options
  };
}

/**
 * Converts the provided option to a normalized format.
 * If the option is not valid, null is returned.
 *
 * @param {object} option
 * @param {string} option.label
 * @param {*} option.value
 *
 * @returns
 */
function _normalizeOption(option) {
  // (1) simple primitive case, use it as both label and value
  if (_isAllowedPrimitive(option)) {
    return {
      value: option,
      label: `${option}`
    };
  }
  if (isObject(option)) {
    const isValidLabel = _isValidLabel(option.label);

    // (2) no label provided, but value is a simple primitive, use it as label and value
    if (!isValidLabel && _isAllowedPrimitive(option.value)) {
      return {
        value: option.value,
        label: `${option.value}`
      };
    }

    // (3) both label and value are provided, use them as is
    if (isValidLabel && _isAllowedValue(option.value)) {
      return option;
    }
  }
  return null;
}
function _isAllowedPrimitive(value) {
  const isAllowedPrimitiveType = ['number', 'string', 'boolean'].includes(typeof value);
  const isValid = value || value === 0 || value === false;
  return isAllowedPrimitiveType && isValid;
}
function _isValidLabel(label) {
  return label && isString(label);
}
function _isAllowedValue(value) {
  if (isObject(value)) {
    return Object.keys(value).length > 0;
  }
  return _isAllowedPrimitive(value);
}

/**
 * Evaluate a string reactively based on the expressionLanguage and form data.
 * If the string is not an expression, it is returned as is.
 * The function is memoized to minimize re-renders.
 *
 * @param {string} value - The string to evaluate.
 * @returns {any} - Evaluated value or the original value if not an expression.
 */
function useExpressionEvaluation(value) {
  const expressionLanguage = useService('expressionLanguage');
  const expressionContextInfo = useContext(LocalExpressionContext);
  return useMemo(() => {
    if (expressionLanguage && expressionLanguage.isExpression(value)) {
      return expressionLanguage.evaluate(value, buildExpressionContext(expressionContextInfo));
    }
    return value;
  }, [expressionLanguage, expressionContextInfo, value]);
}

/**
 * A custom hook to manage state changes with deep comparison.
 *
 * @template T
 * @param {T} value - The current value to manage.
 * @returns {T} - Returns the current state.
 */
function useDeepCompareMemoize(value) {
  const ref = useRef();
  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }
  return ref.current;
}

/**
 * @enum { String }
 */
const LOAD_STATES = {
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error'
};

/**
 * @typedef {Object} OptionsGetter
 * @property {Object[]} options - The options data
 * @property {(LOAD_STATES)} loadState - The options data's loading state, to use for conditional rendering
 */

/**
 * A hook to load options for single and multiselect components.
 *
 * @param {Object} field - The form field to handle options for
 * @return {OptionsGetter} optionsGetter - A options getter object providing loading state and options
 */
function useOptionsAsync(field) {
  const {
    valuesExpression: optionsExpression,
    valuesKey: optionsKey,
    values: staticOptions
  } = field;
  const initialData = useService('form')._getState().initialData;
  const expressionEvaluation = useExpressionEvaluation(optionsExpression);
  const evaluatedOptions = useDeepCompareMemoize(expressionEvaluation || []);
  const optionsGetter = useMemo(() => {
    let options = [];

    // dynamic options
    if (optionsKey !== undefined) {
      const keyedOptions = (initialData || {})[optionsKey];
      if (keyedOptions && Array.isArray(keyedOptions)) {
        options = keyedOptions;
      }

      // static options
    } else if (staticOptions !== undefined) {
      options = Array.isArray(staticOptions) ? staticOptions : [];

      // expression
    } else if (optionsExpression && evaluatedOptions && Array.isArray(evaluatedOptions)) {
      options = evaluatedOptions;

      // error case
    } else {
      return buildErrorState('No options source defined in the form definition');
    }

    // normalize data to support primitives and partially defined objects
    return buildLoadedState(normalizeOptionsData(options));
  }, [optionsKey, staticOptions, initialData, optionsExpression, evaluatedOptions]);
  return optionsGetter;
}
const buildErrorState = error => ({
  options: [],
  error,
  loadState: LOAD_STATES.ERROR
});
const buildLoadedState = options => ({
  options,
  error: undefined,
  loadState: LOAD_STATES.LOADED
});

/**
 * Wrap HTML content in a configuration object for dangerouslySetInnerHTML
 * @param {Object} props
 * @param {string} props.html
 * @param {Function} [props.transform]
 * @param {boolean} [props.sanitize = true]
 * @param {boolean} [props.sanitizeStyleTags = true]
 */
const useDangerousHTMLWrapper = props => {
  const {
    html,
    transform = html => html,
    sanitize = true,
    sanitizeStyleTags = true
  } = props;
  const sanitizedHtml = useMemo(() => sanitize ? DOMPurify.sanitize(html, getDOMPurifyConfig(sanitizeStyleTags)) : html, [html, sanitize, sanitizeStyleTags]);
  const transformedHtml = useMemo(() => transform(sanitizedHtml), [sanitizedHtml, transform]);

  // Return the configuration object for dangerouslySetInnerHTML
  return {
    __html: transformedHtml
  };
};
const getDOMPurifyConfig = sanitizeStyleTags => {
  return {
    FORCE_BODY: true,
    FORBID_TAGS: sanitizeStyleTags ? ['style'] : []
  };
};

/**
 * A custom hook to build up security attributes from form configuration.
 *
 * @param {Object} security - The security configuration.
 * @returns {Array} - Returns a tuple with sandbox and allow attributes.
 */
function useSecurityAttributesMap(security) {
  const securityMemoized = useDeepCompareMemoize(security);
  const sandbox = useMemo(() => SECURITY_ATTRIBUTES_DEFINITIONS.filter(({
    attribute
  }) => attribute === SANDBOX_ATTRIBUTE).filter(({
    property
  }) => get(securityMemoized, [property], false)).map(({
    directive
  }) => directive).join(' '), [securityMemoized]);
  const allow = useMemo(() => SECURITY_ATTRIBUTES_DEFINITIONS.filter(({
    attribute
  }) => attribute !== SANDBOX_ATTRIBUTE).filter(({
    property
  }) => get(securityMemoized, [property], false)).map(({
    directive
  }) => directive).join('; '), [securityMemoized]);
  return [sandbox, allow];
}

/**
 * This hook allows us to retrieve the label from a value in linear time by caching it in a map
 * @param {Array} options
 */
function useGetLabelCorrelation(options) {
  // This allows us to retrieve the label from a value in linear time
  const labelMap = useMemo(() => Object.assign({}, ...options.map(o => ({
    [_getValueHash(o.value)]: o.label
  }))), [options]);
  return useCallback(value => labelMap[_getValueHash(value)], [labelMap]);
}
const _getValueHash = value => {
  return isObject(value) ? JSON.stringify(value) : value;
};

/**
 * Wrap CSS styles with a given prefix.
 *
 * @param {HTMLElement} rootNode
 * @param {string} prefix
 *
 * @returns {HTMLElement}
 */
function wrapCSSStyles(rootNode, prefix) {
  const styleTags = rootNode.querySelectorAll('style');
  styleTags.forEach(styleTag => {
    const topLevelRules = extractTopLevelRules(styleTag.textContent);
    const scopedCss = topLevelRules.map(rule => {
      const {
        selector,
        styles
      } = splitRule(rule);
      const scopedSelector = scopeSelector(selector, prefix);
      return `${scopedSelector} ${styles}`;
    }).join(' ');
    styleTag.textContent = scopedCss;
  });
  return rootNode;
}
function extractTopLevelRules(cssString) {
  let cursor = 0;
  let start = 0;
  let level = 0;
  const topLevelRules = [];
  while (cursor < cssString.length) {
    if (cssString[cursor] === '{') {
      level++;
    }
    if (cssString[cursor] === '}') {
      level--;
      if (level === 0) {
        topLevelRules.push(cssString.substring(start, cursor + 1));
        start = cursor + 1;
      }
    }
    cursor++;
  }
  return topLevelRules.map(rule => rule.trim());
}
function splitRule(rule) {
  const firstBracket = rule.indexOf('{');
  const selector = rule.substring(0, firstBracket);
  const styles = rule.substring(firstBracket);
  return {
    selector,
    styles
  };
}
function scopeSelector(selector, prefix) {
  return selector.split(',').map(sel => `${prefix} ${sel.trim()}`).join(', ');
}
function getScrollContainer(el) {
  while (el && el !== document.body && el !== document.documentElement) {
    if (_isElementScrollable(el)) {
      return el;
    }
    el = el.parentElement;
  }
  if (_isElementScrollable(document.body)) {
    return document.body;
  } else if (_isElementScrollable(document.documentElement)) {
    return document.documentElement;
  }
  return null;
}
function _isElementScrollable(el) {
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY || style.overflow;
  return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
}

const EMPTY_OBJECT = {};
const EMPTY_ARRAY = [];

/**
 * Custom hook to scroll an element within a scrollable container.
 *
 * @param {Object} scrolledElementRef - A ref pointing to the DOM element to scroll into view.
 * @param {Array} deps - An array of dependencies that trigger the effect.
 * @param {Object} [scrollOptions={}] - Options defining the behavior of the scrolling.
 * @param {String} [scrollOptions.align='center'] - The alignment of the element within the viewport.
 * @param {String} [scrollOptions.behavior='auto'] - The scrolling behavior.
 * @param {Number} [scrollOptions.offset=0] - An offset that is added to the scroll position.
 * @param {Boolean} [scrollOptions.scrollIfVisible=false] - Whether to scroll even if the element is visible.
 * @param {Array} [flagRefs] - An array of refs that are used as flags to control when to scroll.
 */
function useScrollIntoView(scrolledElementRef, deps, scrollOptions, flagRefs) {
  const _scrollOptions = scrollOptions || EMPTY_OBJECT;
  const _flagRefs = flagRefs || EMPTY_ARRAY;
  useEffect(() => {
    // return early if flags are not raised, or component is not mounted
    if (some(_flagRefs, ref => !ref.current) || !scrolledElementRef.current) {
      return;
    }
    for (let i = 0; i < _flagRefs.length; i++) {
      _flagRefs[i].current = false;
    }
    const itemToBeScrolled = scrolledElementRef.current;
    const scrollContainer = getScrollContainer(itemToBeScrolled);
    if (!scrollContainer) {
      return;
    }
    const itemRect = itemToBeScrolled.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const {
      align = 'center',
      offset = 0,
      behavior = 'auto',
      scrollIfVisible = false
    } = _scrollOptions;
    const shouldScroll = scrollIfVisible || !(itemRect.top >= containerRect.top && itemRect.bottom <= containerRect.bottom);
    if (!shouldScroll) {
      return;
    }
    const topOffset = _getTopOffset(itemToBeScrolled, scrollContainer, {
      align,
      offset
    });
    scrollContainer.scroll({
      top: topOffset,
      behavior
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// helper //////////////////////

function _getTopOffset(item, scrollContainer, options) {
  const itemRect = item.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  if (options.align === 'top') {
    return itemRect.top - containerRect.top + scrollContainer.scrollTop - options.offset;
  } else if (options.align === 'bottom') {
    return itemRect.bottom - containerRect.top - scrollContainer.clientHeight + scrollContainer.scrollTop + options.offset;
  } else if (options.align === 'center') {
    return itemRect.top - containerRect.top - scrollContainer.clientHeight / 2 + scrollContainer.scrollTop + itemRect.height / 2 + options.offset;
  }
  return 0;
}

/**
 * Returns the conditionally filtered data of a form reactively.
 * Memoised to minimize re-renders
 *
 * Warning: costly operation, use with care
 */
function useFilteredFormData() {
  const {
    initialData,
    data
  } = useService('form')._getState();
  const conditionChecker = useService('conditionChecker', false);
  return useMemo(() => {
    const newData = conditionChecker ? conditionChecker.applyConditions(data, data) : data;
    return {
      ...initialData,
      ...newData
    };
  }, [conditionChecker, data, initialData]);
}

function useKeyDownAction(targetKey, action, listenerElement = window) {
  function downHandler({
    key
  }) {
    if (key === targetKey) {
      action();
    }
  }
  useEffect(() => {
    listenerElement.addEventListener('keydown', downHandler);
    return () => {
      listenerElement.removeEventListener('keydown', downHandler);
    };
  });
}

/**
 * Retrieve readonly value of a form field, given it can be an
 * expression optionally or configured globally.
 *
 * @typedef { import('../../types').FormProperties } FormProperties
 *
 * @param {any} formField
 * @param {FormProperties} properties
 *
 * @returns {boolean}
 */
function useReadonly(formField, properties = {}) {
  const expressionLanguage = useService('expressionLanguage');
  const conditionChecker = useService('conditionChecker', false);
  const expressionContextInfo = useContext(LocalExpressionContext);
  const {
    readonly
  } = formField;
  if (properties.readOnly) {
    return true;
  }
  if (expressionLanguage && expressionLanguage.isExpression(readonly)) {
    return conditionChecker ? conditionChecker.check(readonly, buildExpressionContext(expressionContextInfo)) : false;
  }
  return readonly || false;
}

function usePrevious(value, defaultValue = null) {
  const ref = useRef(defaultValue);
  useEffect(() => ref.current = value, [value]);
  return ref.current;
}

function useFlushDebounce(func) {
  const timeoutRef = useRef(null);
  const lastArgsRef = useRef(null);
  const config = useService('config', false);
  const debounce = config && config.debounce;
  const shouldDebounce = debounce !== false && debounce !== 0;
  const delay = typeof debounce === 'number' ? debounce : 300;
  const debounceFunc = useCallback((...args) => {
    if (!shouldDebounce) {
      func(...args);
      return;
    }
    lastArgsRef.current = args;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      func(...lastArgsRef.current);
      lastArgsRef.current = null;
    }, delay);
  }, [func, delay, shouldDebounce]);
  const flushFunc = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      if (lastArgsRef.current !== null) {
        func(...lastArgsRef.current);
        lastArgsRef.current = null;
      }
      timeoutRef.current = null;
    }
  }, [func]);
  return [debounceFunc, flushFunc];
}

/**
 * Template a string reactively based on form data. If the string is not a template, it is returned as is.
 * Memoised to minimize re-renders
 *
 * @param {string} value
 * @param {Object} options
 * @param {boolean} [options.debug = false]
 * @param {boolean} [options.strict = false]
 * @param {Function} [options.sanitizer]
 * @param {Function} [options.buildDebugString]
 *
 */
function useTemplateEvaluation(value, options = {}) {
  const templating = useService('templating');
  const expressionContextInfo = useContext(LocalExpressionContext);
  return useMemo(() => {
    if (templating && templating.isTemplate(value)) {
      return templating.evaluate(value, buildExpressionContext(expressionContextInfo), options);
    }
    return value;
  }, [templating, value, expressionContextInfo, options]);
}

/**
 * Template a string reactively based on form data. If the string is not a template, it is returned as is.
 * If the string contains multiple lines, only the first line is returned.
 * Memoised to minimize re-renders
 *
 * @param {string} value
 * @param {Object} [options]
 * @param {boolean} [options.debug = false]
 * @param {boolean} [options.strict = false]
 * @param {Function} [options.buildDebugString]
 *
 */
function useSingleLineTemplateEvaluation(value, options = {}) {
  const evaluatedTemplate = useTemplateEvaluation(value, options);
  return useMemo(() => evaluatedTemplate && evaluatedTemplate.split('\n')[0], [evaluatedTemplate]);
}

const ENTER_KEYDOWN_EVENT = new KeyboardEvent('keydown', {
  code: 'Enter',
  key: 'Enter',
  charCode: 13,
  keyCode: 13,
  bubbles: true
});
function focusRelevantFlatpickerDay(flatpickrInstance) {
  if (!flatpickrInstance) return;
  !flatpickrInstance.isOpen && flatpickrInstance.open();
  const container = flatpickrInstance.calendarContainer;
  const dayToFocus = container.querySelector('.flatpickr-day.selected') || container.querySelector('.flatpickr-day.today') || container.querySelector('.flatpickr-day');
  dayToFocus && dayToFocus.focus();
}
function formatTime(use24h, minutes) {
  if (minutes === null) return null;
  const wrappedMinutes = minutes % (24 * 60);
  const minute = minutes % 60;
  let hour = Math.floor(wrappedMinutes / 60);
  if (use24h) {
    return _getZeroPaddedString(hour) + ':' + _getZeroPaddedString(minute);
  }
  hour = hour % 12 || 12;
  const isPM = wrappedMinutes >= 12 * 60;
  return _getZeroPaddedString(hour) + ':' + _getZeroPaddedString(minute) + ' ' + (isPM ? 'PM' : 'AM');
}
function parseInputTime(stringTime) {
  let workingString = stringTime.toLowerCase();
  const is12h = workingString.includes('am') || workingString.includes('pm');
  if (is12h) {
    const isPM = workingString.includes('pm');
    const digits = workingString.match(/\d+/g);
    const displayHour = parseInt(digits && digits[0]);
    const minute = parseInt(digits && digits[1]) || 0;
    const isValidDisplayHour = isNumber(displayHour) && displayHour >= 1 && displayHour <= 12;
    const isValidMinute = minute >= 0 && minute <= 59;
    if (!isValidDisplayHour || !isValidMinute) return null;
    const hour = displayHour % 12 + (isPM ? 12 : 0);
    return hour * 60 + minute;
  } else {
    const digits = workingString.match(/\d+/g);
    const hour = parseInt(digits && digits[0]);
    const minute = parseInt(digits && digits[1]);
    const isValidHour = isNumber(hour) && hour >= 0 && hour <= 23;
    const isValidMinute = isNumber(minute) && minute >= 0 && minute <= 59;
    if (!isValidHour || !isValidMinute) return null;
    return hour * 60 + minute;
  }
}
function serializeTime(minutes, offset, timeSerializingFormat) {
  if (timeSerializingFormat === TIME_SERIALISING_FORMATS.UTC_NORMALIZED) {
    const normalizedMinutes = (minutes + offset + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return _getZeroPaddedString(Math.floor(normalizedMinutes / 60)) + ':' + _getZeroPaddedString(normalizedMinutes % 60) + 'Z';
  }
  const baseTime = _getZeroPaddedString(Math.floor(minutes / 60)) + ':' + _getZeroPaddedString(minutes % 60);
  const addUTCOffset = timeSerializingFormat === TIME_SERIALISING_FORMATS.UTC_OFFSET;
  return baseTime + (addUTCOffset ? formatTimezoneOffset(offset) : '');
}
function parseIsoTime(isoTimeString) {
  if (!isoTimeString) return null;
  const parseBasicMinutes = timeString => {
    const timeSegments = timeString.split(':');
    const hour = parseInt(timeSegments[0]);
    const minute = timeSegments.length > 1 ? parseInt(timeSegments[1]) : 0;
    if (isNaN(hour) || hour < 0 || hour > 24 || isNaN(minute) || minute < 0 || minute > 60) return null;
    return hour * 60 + minute;
  };
  const localOffset = new Date().getTimezoneOffset();

  // Parse normalized time
  if (isoTimeString.includes('Z')) {
    isoTimeString = isoTimeString.replace('Z', '');
    const minutes = parseBasicMinutes(isoTimeString);
    if (minutes === null) return null;
    return (minutes - localOffset + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  // Parse offset positive time
  else if (isoTimeString.includes('+')) {
    const [timeString, offsetString] = isoTimeString.split('+');
    const minutes = parseBasicMinutes(timeString);
    let inboundOffset = parseBasicMinutes(offsetString);
    if (minutes === null || inboundOffset === null) return null;

    // The offset is flipped for consistency with javascript
    inboundOffset = -inboundOffset;
    return (minutes + inboundOffset - localOffset + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  // Parse offset negative time
  else if (isoTimeString.includes('-')) {
    const [timeString, offsetString] = isoTimeString.split('-');
    const minutes = parseBasicMinutes(timeString);
    let inboundOffset = parseBasicMinutes(offsetString);
    if (minutes === null || inboundOffset === null) return null;
    return (minutes + inboundOffset - localOffset + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  // Default to local parsing
  else {
    return parseBasicMinutes(isoTimeString);
  }
}
function serializeDate(date) {
  var d = new Date(date),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
}

// this method is used to make the `new Date(value)` parsing behavior stricter
function isDateTimeInputInformationSufficient(value) {
  if (!value || typeof value !== 'string') return false;
  const segments = value.split('T');
  if (segments.length != 2) return false;
  const dateNumbers = segments[0].split('-');
  if (dateNumbers.length != 3) return false;
  return true;
}

// this method checks if the date isn't a datetime, or a partial date
function isDateInputInformationMatching(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.includes('T')) return false;
  const dateNumbers = value.split('-');
  if (dateNumbers.length != 3) return false;
  return true;
}
function serializeDateTime(date, time, timeSerializingFormat) {
  const workingDate = new Date();
  workingDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  workingDate.setHours(Math.floor(time / 60), time % 60, 0, 0);
  if (timeSerializingFormat === TIME_SERIALISING_FORMATS.UTC_NORMALIZED) {
    const timezoneOffsetMinutes = workingDate.getTimezoneOffset();
    const dayOffset = time + timezoneOffsetMinutes < 0 ? -1 : time + timezoneOffsetMinutes > MINUTES_IN_DAY ? 1 : 0;

    // Apply the date rollover pre-emptively
    workingDate.setHours(workingDate.getHours() + dayOffset * 24);
  }
  return serializeDate(workingDate) + 'T' + serializeTime(time, workingDate.getTimezoneOffset(), timeSerializingFormat);
}
function formatTimezoneOffset(minutes) {
  return _getSignedPaddedHours(minutes) + ':' + _getZeroPaddedString(Math.abs(minutes % 60));
}
function isInvalidDateString(value) {
  return isNaN(new Date(Date.parse(value)).getTime());
}
function getNullDateTime() {
  return {
    date: new Date(Date.parse(null)),
    time: null
  };
}
function isValidDate(date) {
  return date && !isNaN(date.getTime());
}
function isValidTime(time) {
  return !isNaN(parseInt(time));
}
function _getSignedPaddedHours(minutes) {
  if (minutes > 0) {
    return '-' + _getZeroPaddedString(Math.floor(minutes / 60));
  } else {
    return '+' + _getZeroPaddedString(Math.floor((0 - minutes) / 60));
  }
}
function _getZeroPaddedString(time) {
  return time.toString().padStart(2, '0');
}

const ALLOWED_IMAGE_SRC_PATTERN = /^(https?|data):.*/i; // eslint-disable-line no-useless-escape
const ALLOWED_IFRAME_SRC_PATTERN = /^(https):\/\/*/i; // eslint-disable-line no-useless-escape

function sanitizeDateTimePickerValue(options) {
  const {
    formField,
    value
  } = options;
  const {
    subtype
  } = formField;
  if (typeof value !== 'string') return null;
  if (subtype === DATETIME_SUBTYPES.DATE && (isInvalidDateString(value) || !isDateInputInformationMatching(value))) return null;
  if (subtype === DATETIME_SUBTYPES.TIME && parseIsoTime(value) === null) return null;
  if (subtype === DATETIME_SUBTYPES.DATETIME && (isInvalidDateString(value) || !isDateTimeInputInformationSufficient(value))) return null;
  return value;
}
function hasEqualValue(value, array) {
  if (!Array.isArray(array)) {
    return false;
  }
  return array.some(element => isEqual(value, element));
}
function sanitizeSingleSelectValue(options) {
  const {
    formField,
    data,
    value
  } = options;
  const {
    valuesExpression: optionsExpression
  } = formField;
  try {
    // if options are expression evaluated, we don't need to sanitize the value against the options
    // and defer to the field's internal validation
    if (optionsExpression) {
      return value;
    }
    const validValues = normalizeOptionsData(getSimpleOptionsData(formField, data)).map(v => v.value);
    return hasEqualValue(value, validValues) ? value : null;
  } catch (error) {
    // use default value in case of formatting error
    // TODO(@Skaiir): log a warning when this happens - https://github.com/bpmn-io/form-js/issues/289
    return null;
  }
}
function sanitizeMultiSelectValue(options) {
  const {
    formField,
    data,
    value
  } = options;
  const {
    valuesExpression: optionsExpression
  } = formField;
  try {
    // if options are expression evaluated, we don't need to sanitize the values against the options
    // and defer to the field's internal validation
    if (optionsExpression) {
      return value;
    }
    const validValues = normalizeOptionsData(getSimpleOptionsData(formField, data)).map(v => v.value);
    return value.filter(v => hasEqualValue(v, validValues));
  } catch (error) {
    // use default value in case of formatting error
    // TODO(@Skaiir): log a warning when this happens - https://github.com/bpmn-io/form-js/issues/289
    return [];
  }
}

/**
 * Sanitizes an image source to ensure we only allow for data URI and links
 * that start with http(s).
 *
 * Note: Most browsers anyway do not support script execution in <img> elements.
 *
 * @param {string} src
 * @returns {string}
 */
function sanitizeImageSource(src) {
  const valid = ALLOWED_IMAGE_SRC_PATTERN.test(src);
  return valid ? src : '';
}

/**
 * Sanitizes an iframe source to ensure we only allow for links
 * that start with http(s).
 *
 * @param {string} src
 * @returns {string}
 */
function sanitizeIFrameSource(src) {
  const valid = ALLOWED_IFRAME_SRC_PATTERN.test(src);
  return valid ? src : '';
}

/**
 * Escapes HTML and returns pure text.
 * @param {string} html
 * @returns {string}
 */
function escapeHTML(html) {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '{': '&#123;',
    '}': '&#125;',
    ':': '&#58;',
    ';': '&#59;'
  };
  return html.replace(/[&<>"'{};:]/g, match => escapeMap[match]);
}

function useCleanupSingleSelectValue(props) {
  const {
    field,
    options,
    loadState,
    onChange,
    value
  } = props;

  // Ensures that the value is always one of the possible options
  useEffect(() => {
    if (loadState !== LOAD_STATES.LOADED) {
      return;
    }
    const optionValues = options.map(o => o.value);
    const hasValueNotInOptions = value && !hasEqualValue(value, optionValues);
    if (hasValueNotInOptions) {
      onChange({
        field,
        value: null
      });
    }
  }, [field, options, onChange, value, loadState]);
}

function useCleanupMultiSelectValue(props) {
  const {
    field,
    options,
    loadState,
    onChange,
    values
  } = props;
  const memoizedValues = useDeepCompareMemoize(values || []);

  // ensures that the values are always a subset of the possible options
  useEffect(() => {
    if (loadState !== LOAD_STATES.LOADED) {
      return;
    }
    const optionValues = options.map(o => o.value);
    const hasValuesNotInOptions = memoizedValues.some(v => !hasEqualValue(v, optionValues));
    if (hasValuesNotInOptions) {
      onChange({
        field,
        value: memoizedValues.filter(v => hasEqualValue(v, optionValues))
      });
    }
  }, [field, options, onChange, memoizedValues, loadState]);
}

function Description(props) {
  const {
    description,
    id
  } = props;
  const evaluatedDescription = useSingleLineTemplateEvaluation(description || '', {
    debug: true
  });
  if (!evaluatedDescription) {
    return null;
  }
  return jsx("div", {
    id: id,
    class: "fjs-form-field-description",
    children: evaluatedDescription
  });
}

function Errors(props) {
  const {
    errors,
    id
  } = props;
  if (!errors.length) {
    return null;
  }
  return jsx("div", {
    class: "fjs-form-field-error",
    "aria-live": "polite",
    id: id,
    children: jsx("ul", {
      children: errors.map(error => {
        return jsx("li", {
          children: error
        });
      })
    })
  });
}

function Label(props) {
  const {
    id,
    htmlFor,
    label,
    collapseOnEmpty = true,
    required = false
  } = props;
  const evaluatedLabel = useSingleLineTemplateEvaluation(label || '', {
    debug: true
  });
  return jsxs("label", {
    id: id,
    for: htmlFor,
    class: classNames('fjs-form-field-label', {
      'fjs-incollapsible-label': !collapseOnEmpty
    }, props['class']),
    children: [props.children, evaluatedLabel, required && jsx("span", {
      class: "fjs-asterix",
      "aria-hidden": true,
      children: "*"
    })]
  });
}

const type$g = 'checkbox';
function Checkbox(props) {
  const {
    disabled,
    errors = [],
    domId,
    onBlur,
    onFocus,
    field,
    readonly,
    value = false
  } = props;
  const {
    description,
    label,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const onChange = ({
    target
  }) => {
    props.onChange({
      field,
      value: target.checked
    });
  };
  const descriptionId = `${domId}-description`;
  const errorMessageId = `${domId}-error-message`;
  return jsxs("div", {
    class: classNames(formFieldClasses(type$g, {
      errors,
      disabled,
      readonly
    }), {
      'fjs-checked': value
    }),
    children: [jsx(Label, {
      htmlFor: domId,
      label: label,
      required: required,
      children: jsx("input", {
        checked: value,
        class: "fjs-input",
        disabled: disabled,
        readOnly: readonly,
        id: domId,
        type: "checkbox",
        onChange: onChange,
        onBlur: () => onBlur && onBlur(),
        onFocus: () => onFocus && onFocus(),
        required: required,
        "aria-invalid": errors.length > 0,
        "aria-describedby": [descriptionId, errorMessageId].join(' ')
      })
    }), jsx(Description, {
      id: descriptionId,
      description: description
    }), jsx(Errors, {
      id: errorMessageId,
      errors: errors
    })]
  });
}
Checkbox.config = {
  type: type$g,
  keyed: true,
  label: 'Zaškrtávací pole',
  group: 'selection',
  emptyValue: false,
  sanitizeValue: ({
    value
  }) => value === true,
  create: (options = {}) => ({
    ...options
  })
};

const type$f = 'checklist';
function Checklist(props) {
  const {
    disabled,
    errors = [],
    domId,
    onBlur,
    onFocus,
    field,
    readonly,
    value: values = []
  } = props;
  const {
    description,
    label,
    validate = {}
  } = field;
  const outerDivRef = useRef();
  const {
    required
  } = validate;
  const toggleCheckbox = toggledValue => {
    const newValues = hasEqualValue(toggledValue, values) ? values.filter(value => !isEqual(value, toggledValue)) : [...values, toggledValue];
    props.onChange({
      field,
      value: newValues
    });
  };
  const onCheckboxBlur = e => {
    if (outerDivRef.current.contains(e.relatedTarget)) {
      return;
    }
    onBlur && onBlur();
  };
  const onCheckboxFocus = e => {
    if (outerDivRef.current.contains(e.relatedTarget)) {
      return;
    }
    onFocus && onFocus();
  };
  const {
    loadState,
    options
  } = useOptionsAsync(field);
  useCleanupMultiSelectValue({
    field,
    loadState,
    options,
    values,
    onChange: props.onChange
  });
  const descriptionId = `${domId}-description`;
  const errorMessageId = `${domId}-error-message`;
  return jsxs("div", {
    class: classNames(formFieldClasses(type$f, {
      errors,
      disabled,
      readonly
    })),
    ref: outerDivRef,
    children: [jsx(Label, {
      label: label,
      required: required
    }), loadState == LOAD_STATES.LOADED && options.map((o, index) => {
      const itemDomId = `${domId}-${index}`;
      const isChecked = hasEqualValue(o.value, values);
      return jsx(Label, {
        htmlFor: itemDomId,
        label: o.label,
        class: classNames({
          'fjs-checked': isChecked
        }),
        required: false,
        children: jsx("input", {
          checked: isChecked,
          class: "fjs-input",
          disabled: disabled,
          readOnly: readonly,
          id: itemDomId,
          type: "checkbox",
          onClick: () => toggleCheckbox(o.value),
          onBlur: onCheckboxBlur,
          onFocus: onCheckboxFocus,
          required: required,
          "aria-invalid": errors.length > 0,
          "aria-describedby": [descriptionId, errorMessageId].join(' ')
        })
      });
    }), jsx(Description, {
      id: descriptionId,
      description: description
    }), jsx(Errors, {
      id: errorMessageId,
      errors: errors
    })]
  });
}
Checklist.config = {
  type: type$f,
  keyed: true,
  label: 'Zaškrtávací seznam',
  group: 'selection',
  emptyValue: [],
  sanitizeValue: sanitizeMultiSelectValue,
  create: createEmptyOptions
};

const noop$1 = () => false;
function FormField(props) {
  const {
    field,
    indexes,
    onChange
  } = props;
  const formFields = useService('formFields'),
    viewerCommands = useService('viewerCommands', false),
    pathRegistry = useService('pathRegistry'),
    eventBus = useService('eventBus'),
    form = useService('form');
  const {
    initialData,
    data,
    errors,
    properties
  } = form._getState();
  const {
    Element,
    Hidden,
    Column
  } = useContext(FormRenderContext);
  const {
    formId
  } = useContext(FormContext);

  // track whether we should trigger initial validation on certain actions, e.g. field blur
  // disabled straight away, if viewerCommands are not available
  const [initialValidationTrigger, setInitialValidationTrigger] = useState(!!viewerCommands);
  const FormFieldComponent = formFields.get(field.type);
  if (!FormFieldComponent) {
    throw new Error(`cannot render field <${field.type}>`);
  }
  const fieldConfig = FormFieldComponent.config;
  const valuePath = useMemo(() => pathRegistry.getValuePath(field, {
    indexes
  }), [field, indexes, pathRegistry]);
  const initialValue = useMemo(() => get(initialData, valuePath), [initialData, valuePath]);
  const readonly = useReadonly(field, properties);
  const value = get(data, valuePath);

  // add precedence: global readonly > form field disabled
  const disabled = !properties.readOnly && (properties.disabled || field.disabled || false);

  // ensures the initial validation behavior can be re-triggered upon form reset
  useEffect(() => {
    if (!viewerCommands) {
      return;
    }
    const resetValidation = () => {
      setInitialValidationTrigger(true);
    };
    eventBus.on('import.done', resetValidation);
    eventBus.on('reset', resetValidation);
    return () => {
      eventBus.off('import.done', resetValidation);
      eventBus.off('reset', resetValidation);
    };
  }, [eventBus, viewerCommands]);
  useEffect(() => {
    const hasInitialValue = initialValue && !isEqual(initialValue, []);
    if (initialValidationTrigger && hasInitialValue) {
      setInitialValidationTrigger(false);
      viewerCommands.updateFieldValidation(field, initialValue, indexes);
    }
  }, [viewerCommands, field, initialValue, initialValidationTrigger, indexes]);
  const onBlur = useCallback(() => {
    const value = get(data, valuePath);
    if (initialValidationTrigger) {
      setInitialValidationTrigger(false);
      viewerCommands.updateFieldValidation(field, value, indexes);
    }
    eventBus.fire('formField.blur', {
      formField: field
    });
  }, [eventBus, field, indexes, viewerCommands, initialValidationTrigger, data, valuePath]);
  const onFocus = useCallback(() => {
    eventBus.fire('formField.focus', {
      formField: field
    });
  }, [eventBus, field]);
  const hidden = useCondition(field.conditional && field.conditional.hide || null);
  const onChangeIndexed = useCallback(update => {
    // any data change will trigger validation
    setInitialValidationTrigger(false);

    // add indexes of the keyed field to the update, if any
    onChange(fieldConfig.keyed ? {
      ...update,
      indexes
    } : update);
  }, [onChange, fieldConfig.keyed, indexes]);
  if (hidden) {
    return jsx(Hidden, {
      field: field
    });
  }
  const domId = `${prefixId(field.id, formId, indexes)}`;
  const fieldErrors = get(errors, [field.id, ...Object.values(indexes || {})]) || [];
  const formFieldElement = jsx(FormFieldComponent, {
    ...props,
    disabled: disabled,
    errors: fieldErrors,
    domId: domId,
    onChange: disabled || readonly ? noop$1 : onChangeIndexed,
    onBlur: disabled || readonly ? noop$1 : onBlur,
    onFocus: disabled || readonly ? noop$1 : onFocus,
    readonly: readonly,
    value: value
  });
  if (fieldConfig.escapeGridRender) {
    return formFieldElement;
  }
  return jsx(Column, {
    field: field,
    class: gridColumnClasses(field),
    children: jsx(Element, {
      class: "fjs-element",
      field: field,
      children: formFieldElement
    })
  });
}

function ChildrenRenderer(props) {
  const {
    Children
  } = useContext(FormRenderContext);
  const {
    field,
    Empty
  } = props;
  const {
    id
  } = field;
  const repeatRenderManager = useService('repeatRenderManager', false);
  const isRepeating = repeatRenderManager && repeatRenderManager.isFieldRepeating(id);
  const Repeater = repeatRenderManager.Repeater;
  const RepeatFooter = repeatRenderManager.RepeatFooter;
  return isRepeating ? jsx(RepeatChildrenRenderer, {
    ...props,
    ChildrenRoot: Children,
    Empty,
    Repeater,
    RepeatFooter,
    repeatRenderManager
  }) : jsx(SimpleChildrenRenderer, {
    ...props,
    ChildrenRoot: Children,
    Empty
  });
}
function SimpleChildrenRenderer(props) {
  const {
    ChildrenRoot,
    Empty,
    field
  } = props;
  const {
    components = []
  } = field;
  const isEmpty = !components.length;
  return jsxs(ChildrenRoot, {
    class: "fjs-vertical-layout fjs-children cds--grid cds--grid--condensed",
    field: field,
    children: [jsx(RowsRenderer, {
      ...props
    }), isEmpty ? jsx(Empty, {
      field: field
    }) : null]
  });
}
function RepeatChildrenRenderer(props) {
  const {
    ChildrenRoot,
    repeatRenderManager,
    Empty,
    field,
    ...restProps
  } = props;
  const {
    components = []
  } = field;
  const useSharedState = useState({
    isCollapsed: true
  });
  const Repeater = repeatRenderManager.Repeater;
  const RepeatFooter = repeatRenderManager.RepeatFooter;
  return jsxs(Fragment, {
    children: [jsxs(ChildrenRoot, {
      class: "fjs-vertical-layout fjs-children cds--grid cds--grid--condensed",
      field: field,
      children: [Repeater ? jsx(Repeater, {
        ...restProps,
        useSharedState,
        field,
        RowsRenderer
      }) : jsx(RowsRenderer, {
        ...restProps,
        field
      }), !components.length ? jsx(Empty, {
        field: field
      }) : null]
    }), RepeatFooter ? jsx(RepeatFooter, {
      ...restProps,
      useSharedState,
      field
    }) : null]
  });
}
function RowsRenderer(props) {
  const {
    field,
    indexes
  } = props;
  const {
    id: parentId,
    verticalAlignment = 'start'
  } = field;
  const formLayouter = useService('formLayouter');
  const formFieldRegistry = useService('formFieldRegistry');
  const rows = formLayouter.getRows(parentId);
  const {
    Row
  } = useContext(FormRenderContext);
  return jsxs(Fragment, {
    children: [" ", rows.map(row => {
      const {
        components = []
      } = row;
      if (!components.length) {
        return null;
      }
      return jsx(Row, {
        row: row,
        class: "fjs-layout-row cds--row",
        style: {
          alignItems: verticalAlignment
        },
        children: components.map(childId => {
          const childField = formFieldRegistry.get(childId);
          if (!childField) {
            return null;
          }
          return createElement(FormField, {
            ...props,
            key: childId,
            field: childField,
            indexes: indexes
          });
        })
      });
    }), " "]
  });
}

function Default(props) {
  const {
    Empty
  } = useContext(FormRenderContext);
  const fullProps = {
    ...props,
    Empty
  };
  return jsx(ChildrenRenderer, {
    ...fullProps
  });
}
Default.config = {
  type: 'default',
  keyed: false,
  label: null,
  group: null,
  create: (options = {}) => ({
    components: [],
    ...options
  })
};

var _path$w;
function _extends$x() { _extends$x = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$x.apply(this, arguments); }
var SvgCalendar = function SvgCalendar(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$x({
    xmlns: "http://www.w3.org/2000/svg",
    width: 14,
    height: 15,
    fill: "none",
    viewBox: "0 0 28 30"
  }, props), _path$w || (_path$w = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    d: "M19 2H9V0H7v2H2a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-5V0h-2v2ZM7 7V4H2v5h24V4h-5v3h-2V4H9v3H7Zm-5 4v17h24V11H2Z",
    clipRule: "evenodd"
  })));
};
var CalendarIcon = SvgCalendar;

/**
 * Returns date format for the provided locale.
 * If the locale is not provided, uses the browser's locale.
 *
 * @param {string} [locale] - The locale to get date format for.
 * @returns {string} The date format for the locale.
 */
function getLocaleDateFormat(locale = 'default') {
  // FIX: flatpickr wrong serialization, use de (german dd.mm.yyyy) insted of cs (czech dd. mm. yyyy)
  const parts = new Intl.DateTimeFormat('de').formatToParts(new Date(Date.UTC(2020, 5, 5)));
  return parts.map(part => {
    const len = part.value.length;
    switch (part.type) {
      case 'day':
        return 'd'.repeat(len);
      case 'month':
        return 'M'.repeat(len);
      case 'year':
        return 'y'.repeat(len);
      default:
        return part.value;
    }
  }).join('');
}

/**
 * Returns readable date format for the provided locale.
 * If the locale is not provided, uses the browser's locale.
 *
 * @param {string} [locale] - The locale to get readable date format for.
 * @returns {string} The readable date format for the locale.
 */
function getLocaleReadableDateFormat(locale) {
  let format = getLocaleDateFormat(locale).toLowerCase();

  // Ensure month is in 'mm' format
  if (!format.includes('mm')) {
    format = format.replace('m', 'mm');
  }

  // Ensure day is in 'dd' format
  if (!format.includes('dd')) {
    format = format.replace('d', 'dd');
  }
  return format;
}

/**
 * Returns flatpickr config for the provided locale.
 * If the locale is not provided, uses the browser's locale.
 *
 * @param {string} [locale] - The locale to get flatpickr config for.
 * @returns {object} The flatpickr config for the locale.
 */
function getLocaleDateFlatpickrConfig(locale) {
  return flatpickerizeDateFormat(getLocaleDateFormat(locale));
}
function flatpickerizeDateFormat(dateFormat) {
  const useLeadingZero = {
    day: dateFormat.includes('dd'),
    month: dateFormat.includes('MM'),
    year: dateFormat.includes('yyyy')
  };
  dateFormat = useLeadingZero.day ? dateFormat.replace('dd', 'd') : dateFormat.replace('d', 'j');
  dateFormat = useLeadingZero.month ? dateFormat.replace('MM', 'm') : dateFormat.replace('M', 'n');
  dateFormat = useLeadingZero.year ? dateFormat.replace('yyyy', 'Y') : dateFormat.replace('yy', 'y');
  return dateFormat;
}

function InputAdorner(props) {
  const {
    pre,
    post,
    rootRef,
    inputRef,
    children,
    disabled,
    readonly,
    hasErrors
  } = props;
  const onAdornmentClick = () => inputRef && inputRef.current && inputRef.current.focus();
  return jsxs("div", {
    class: classNames('fjs-input-group', {
      'fjs-disabled': disabled,
      'fjs-readonly': readonly
    }, {
      'hasErrors': hasErrors
    }),
    ref: rootRef,
    children: [pre && jsxs("span", {
      class: "fjs-input-adornment border-right border-radius-left",
      onClick: onAdornmentClick,
      children: [" ", isString(pre) ? jsx("span", {
        class: "fjs-input-adornment-text",
        children: pre
      }) : pre, " "]
    }), children, post && jsxs("span", {
      class: "fjs-input-adornment border-left border-radius-right",
      onClick: onAdornmentClick,
      children: [" ", isString(post) ? jsx("span", {
        class: "fjs-input-adornment-text",
        children: post
      }) : post, " "]
    })]
  });
}

function Datepicker(props) {
  const {
    label,
    domId,
    collapseLabelOnEmpty,
    onDateTimeBlur,
    onDateTimeFocus,
    required,
    disabled,
    disallowPassedDates,
    date: dateObject,
    readonly,
    setDate
  } = props;
  const dateInputRef = useRef();
  const focusScopeRef = useRef();
  const [flatpickrInstance, setFlatpickrInstance] = useState(null);
  const [isInputDirty, setIsInputDirty] = useState(false);
  const [forceFocusCalendar, setForceFocusCalendar] = useState(false);

  // ensures we render based on date value instead of reference
  const date = useDeepCompareMemoize(dateObject);

  // shorts the date value back to the source
  useEffect(() => {
    if (!flatpickrInstance || !flatpickrInstance.config) return;
    flatpickrInstance.setDate(date, true);
    setIsInputDirty(false);
  }, [flatpickrInstance, date]);
  useEffect(() => {
    if (!forceFocusCalendar) return;
    focusRelevantFlatpickerDay(flatpickrInstance);
    setForceFocusCalendar(false);
  }, [flatpickrInstance, forceFocusCalendar]);

  // setup flatpickr instance
  useEffect(() => {
    let config = {
      allowInput: true,
      dateFormat: getLocaleDateFlatpickrConfig(),
      static: true,
      clickOpens: false,
      locale: Czech,
      // TODO: support dates prior to 1900 (https://github.com/bpmn-io/form-js/issues/533)
      minDate: disallowPassedDates ? 'today' : '01/01/1900',
      errorHandler: () => {/* do nothing, we expect the values to sometimes be erronous and we don't want warnings polluting the console */}
    };
    const instance = flatpickr(dateInputRef.current, config);
    setFlatpickrInstance(instance);
    const onCalendarFocusOut = e => {
      if (!instance.calendarContainer.contains(e.relatedTarget) && e.relatedTarget != dateInputRef.current) {
        instance.close();
      }
    };

    // remove dirty tag to have mouse day selection prioritize input blur
    const onCalendarMouseDown = e => {
      if (e.target.classList.contains('flatpickr-day')) {
        setIsInputDirty(false);
      }
    };

    // when the dropdown of the datepickr opens, we register a few event handlers to re-implement some of the
    // flatpicker logic that was lost when setting allowInput to true
    instance.config.onOpen = [() => instance.calendarContainer.addEventListener('focusout', onCalendarFocusOut), () => instance.calendarContainer.addEventListener('mousedown', onCalendarMouseDown)];
    instance.config.onClose = [() => instance.calendarContainer.removeEventListener('focusout', onCalendarFocusOut), () => instance.calendarContainer.removeEventListener('mousedown', onCalendarMouseDown)];
  }, [disallowPassedDates]);

  // onChange is updated dynamically, so not to re-render the flatpicker every time it changes
  useEffect(() => {
    if (!flatpickrInstance || !flatpickrInstance.config) return;
    flatpickrInstance.config.onChange = [date => setDate(new Date(date)), () => setIsInputDirty(false)];
  }, [flatpickrInstance, setDate]);
  const onInputKeyDown = useCallback(e => {
    if (!flatpickrInstance) return;
    if (e.code === 'Escape') {
      flatpickrInstance.close();
    }
    if (e.code === 'ArrowDown') {
      if (isInputDirty) {
        // trigger an enter keypress to submit the new input, then focus calendar day on the next render cycle
        dateInputRef.current.dispatchEvent(ENTER_KEYDOWN_EVENT);
        setIsInputDirty(false);
        setForceFocusCalendar(true);
      } else {
        // focus calendar day immediately
        focusRelevantFlatpickerDay(flatpickrInstance);
      }
      e.preventDefault();
    }
    if (e.code === 'Enter') {
      setIsInputDirty(false);
    }
  }, [flatpickrInstance, isInputDirty]);
  const onInputFocus = useCallback(e => {
    if (!flatpickrInstance || focusScopeRef.current.contains(e.relatedTarget) || readonly) return;
    flatpickrInstance.open();
    onDateTimeFocus(e);
  }, [flatpickrInstance, readonly, onDateTimeFocus]);

  // simulate an enter press on blur to make sure the date value is submitted in all scenarios
  const onInputBlur = useCallback(e => {
    const isFalseBlur = e.relatedTarget && e.relatedTarget.classList.contains('flatpickr-day');
    if (isFalseBlur) return;
    if (isInputDirty) {
      dateInputRef.current.dispatchEvent(ENTER_KEYDOWN_EVENT);
      setIsInputDirty(false);
    }
    onDateTimeBlur(e);
  }, [isInputDirty, onDateTimeBlur]);
  return jsxs("div", {
    class: "fjs-datetime-subsection",
    children: [jsx(Label, {
      htmlFor: domId,
      label: label,
      collapseOnEmpty: collapseLabelOnEmpty,
      required: required
    }), jsx(InputAdorner, {
      pre: jsx(CalendarIcon, {}),
      disabled: disabled,
      readonly: readonly,
      rootRef: focusScopeRef,
      inputRef: dateInputRef,
      children: jsx("div", {
        class: "fjs-datepicker",
        style: {
          width: '100%'
        },
        children: jsx("input", {
          ref: dateInputRef,
          type: "text",
          id: domId,
          class: "fjs-input",
          disabled: disabled,
          readOnly: readonly,
          placeholder: getLocaleReadableDateFormat(),
          autoComplete: "off",
          onFocus: onInputFocus,
          onBlur: onInputBlur,
          onKeyDown: onInputKeyDown,
          onMouseDown: () => !flatpickrInstance.isOpen && !readonly && flatpickrInstance.open(),
          onInput: () => setIsInputDirty(true),
          "data-input": true,
          "aria-describedby": props['aria-describedby']
        })
      })
    })]
  });
}

var _path$v, _path2$4;
function _extends$w() { _extends$w = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$w.apply(this, arguments); }
var SvgClock = function SvgClock(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$w({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none",
    viewBox: "0 0 28 29"
  }, props), _path$v || (_path$v = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "M13 14.41 18.59 20 20 18.59l-5-5.01V5h-2v9.41Z"
  })), _path2$4 || (_path2$4 = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    d: "M6.222 25.64A14 14 0 1 0 21.778 2.36 14 14 0 0 0 6.222 25.64ZM7.333 4.023a12 12 0 1 1 13.334 19.955A12 12 0 0 1 7.333 4.022Z",
    clipRule: "evenodd"
  })));
};
var ClockIcon = SvgClock;

const DEFAULT_LABEL_GETTER = value => value;
const NOOP = () => {};
function DropdownList(props) {
  const {
    listenerElement = window,
    values = [],
    getLabel = DEFAULT_LABEL_GETTER,
    onValueSelected = NOOP,
    height = 235,
    emptyListMessage = 'No results',
    initialFocusIndex = 0
  } = props;
  const [mouseControl, setMouseControl] = useState(false);
  const [focusedValueIndex, setFocusedValueIndex] = useState(initialFocusIndex);
  const [smoothScrolling, setSmoothScrolling] = useState(false);
  const dropdownContainer = useRef();
  const mouseScreenPos = useRef();
  const focusedItem = useMemo(() => values.length ? values[focusedValueIndex] : null, [focusedValueIndex, values]);
  const changeFocusedValueIndex = useCallback(delta => {
    setFocusedValueIndex(x => Math.min(Math.max(0, x + delta), values.length - 1));
  }, [values.length]);
  useEffect(() => {
    if (focusedValueIndex === 0) return;
    if (!focusedValueIndex || !values.length) {
      setFocusedValueIndex(0);
    } else if (focusedValueIndex >= values.length) {
      setFocusedValueIndex(values.length - 1);
    }
  }, [focusedValueIndex, values.length]);
  useKeyDownAction('ArrowUp', () => {
    if (values.length) {
      changeFocusedValueIndex(-1);
      setMouseControl(false);
    }
  }, listenerElement);
  useKeyDownAction('ArrowDown', () => {
    if (values.length) {
      changeFocusedValueIndex(1);
      setMouseControl(false);
    }
  }, listenerElement);
  useKeyDownAction('Enter', () => {
    if (focusedItem) {
      onValueSelected(focusedItem);
    }
  }, listenerElement);
  useEffect(() => {
    const individualEntries = dropdownContainer.current.children;
    if (individualEntries.length && !mouseControl) {
      const focusedEntry = individualEntries[focusedValueIndex];
      focusedEntry && focusedEntry.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [focusedValueIndex, mouseControl]);
  useEffect(() => {
    setSmoothScrolling(true);
  }, []);
  const onMouseMovedInKeyboardMode = (event, valueIndex) => {
    const userMovedCursor = !mouseScreenPos.current || mouseScreenPos.current.x !== event.screenX && mouseScreenPos.current.y !== event.screenY;
    if (userMovedCursor) {
      mouseScreenPos.current = {
        x: event.screenX,
        y: event.screenY
      };
      setMouseControl(true);
      setFocusedValueIndex(valueIndex);
    }
  };
  return jsxs("div", {
    ref: dropdownContainer,
    tabIndex: -1,
    class: "fjs-dropdownlist",
    onMouseDown: e => e.preventDefault(),
    style: {
      maxHeight: height,
      scrollBehavior: smoothScrolling ? 'smooth' : 'auto'
    },
    children: [values.length > 0 && values.map((v, i) => {
      return jsx("div", {
        class: classNames('fjs-dropdownlist-item', {
          'focused': focusedValueIndex === i
        }),
        onMouseMove: mouseControl ? undefined : e => onMouseMovedInKeyboardMode(e, i),
        onMouseEnter: mouseControl ? () => setFocusedValueIndex(i) : undefined,
        onMouseDown: e => onValueSelected(v),
        children: getLabel(v)
      });
    }), !values.length && jsx("div", {
      class: "fjs-dropdownlist-empty",
      children: emptyListMessage
    })]
  });
}

function Timepicker(props) {
  const {
    label,
    collapseLabelOnEmpty,
    onDateTimeBlur,
    onDateTimeFocus,
    domId,
    required,
    disabled,
    readonly,
    use24h = true,
    timeInterval,
    time,
    setTime
  } = props;
  const safeTimeInterval = useMemo(() => {
    const allowedIntervals = [1, 5, 10, 15, 30, 60];
    if (allowedIntervals.includes(timeInterval)) {
      return timeInterval;
    }
    return 15;
  }, [timeInterval]);
  const timeInputRef = useRef();
  const [dropdownIsOpen, setDropdownIsOpen] = useState(false);
  const useDropdown = useMemo(() => safeTimeInterval !== 1, [safeTimeInterval]);
  const [rawValue, setRawValue] = useState('');

  // populates values from source
  useEffect(() => {
    if (time === null) {
      setRawValue('');
      return;
    }
    const intervalAdjustedTime = time - time % safeTimeInterval;
    setRawValue(formatTime(use24h, intervalAdjustedTime));
    if (intervalAdjustedTime != time) {
      setTime(intervalAdjustedTime);
    }
  }, [time, setTime, use24h, safeTimeInterval]);
  const propagateRawToMinute = useCallback(newRawValue => {
    const localRawValue = newRawValue || rawValue;

    // If no raw value exists, set the minute to null
    if (!localRawValue) {
      setTime(null);
      return;
    }
    const minutes = parseInputTime(localRawValue);

    // If raw string couldn't be parsed, clean everything up
    if (!isNumber(minutes)) {
      setRawValue('');
      setTime(null);
      return;
    }

    // Enforce the minutes to match the timeInterval
    const correctedMinutes = minutes - minutes % safeTimeInterval;

    // Enforce the raw text to be formatted properly
    setRawValue(formatTime(use24h, correctedMinutes));
    setTime(correctedMinutes);
  }, [rawValue, safeTimeInterval, use24h, setTime]);
  const timeOptions = useMemo(() => {
    const minutesInDay = 24 * 60;
    const intervalCount = Math.floor(minutesInDay / safeTimeInterval);
    return [...Array(intervalCount).keys()].map(intervalIndex => formatTime(use24h, intervalIndex * safeTimeInterval));
  }, [safeTimeInterval, use24h]);
  const initialFocusIndex = useMemo(() => {
    // if there are no options, there will not be any focusing
    if (!timeOptions || !safeTimeInterval) return null;

    // if there is a set minute value, we focus it in the dropdown
    if (time) return time / safeTimeInterval;
    const cacheTime = parseInputTime(rawValue);

    // if there is a valid value in the input cache, we try and focus close to it
    if (cacheTime) {
      const flooredCacheTime = cacheTime - cacheTime % safeTimeInterval;
      return flooredCacheTime / safeTimeInterval;
    }

    // If there is no set value, simply focus the middle of the dropdown (12:00)
    return Math.floor(timeOptions.length / 2);
  }, [rawValue, time, safeTimeInterval, timeOptions]);
  const onInputKeyDown = e => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'ArrowDown':
        useDropdown && setDropdownIsOpen(true);
        e.preventDefault();
        break;
      case 'Escape':
        useDropdown && setDropdownIsOpen(false);
        break;
      case 'Enter':
        !dropdownIsOpen && propagateRawToMinute();
        break;
    }
  };
  const onInputBlur = e => {
    setDropdownIsOpen(false);
    propagateRawToMinute();
    onDateTimeBlur(e);
  };
  const onInputFocus = e => {
    onDateTimeFocus(e);
    !readonly && useDropdown && setDropdownIsOpen(true);
  };
  const onDropdownValueSelected = value => {
    setDropdownIsOpen(false);
    propagateRawToMinute(value);
  };
  return jsxs("div", {
    class: "fjs-datetime-subsection",
    children: [jsx(Label, {
      htmlFor: domId,
      label: label,
      collapseOnEmpty: collapseLabelOnEmpty,
      required: required
    }), jsx(InputAdorner, {
      pre: jsx(ClockIcon, {}),
      inputRef: timeInputRef,
      disabled: disabled,
      readonly: readonly,
      children: jsxs("div", {
        class: "fjs-timepicker fjs-timepicker-anchor",
        children: [jsx("input", {
          ref: timeInputRef,
          type: "text",
          id: domId,
          class: "fjs-input",
          value: rawValue,
          disabled: disabled,
          readOnly: readonly,
          placeholder: use24h ? 'hh:mm' : 'hh:mm ?m',
          autoComplete: "off"

          // @ts-ignore
          ,
          onInput: e => {
            setRawValue(e.target.value);
            useDropdown && setDropdownIsOpen(false);
          },
          onBlur: onInputBlur,
          onFocus: onInputFocus,
          onClick: () => !readonly && useDropdown && setDropdownIsOpen(true),
          onKeyDown: onInputKeyDown,
          "data-input": true,
          "aria-describedby": props['aria-describedby']
        }), dropdownIsOpen && jsx(DropdownList, {
          values: timeOptions,
          height: 150,
          onValueSelected: onDropdownValueSelected,
          listenerElement: timeInputRef.current,
          initialFocusIndex: initialFocusIndex
        })]
      })
    })]
  });
}

const type$e = 'datetime';
function Datetime(props) {
  const {
    disabled,
    errors = [],
    domId,
    onBlur,
    onFocus,
    field,
    onChange,
    readonly,
    value = ''
  } = props;
  const {
    description,
    id,
    dateLabel,
    timeLabel,
    validate = {},
    subtype,
    use24h,
    disallowPassedDates,
    timeInterval,
    timeSerializingFormat
  } = field;
  const {
    required
  } = validate;
  const {
    formId
  } = useContext(FormContext);
  const dateTimeGroupRef = useRef();
  const [dateTime, setDateTime] = useState(getNullDateTime());
  const [dateTimeUpdateRequest, setDateTimeUpdateRequest] = useState(null);
  const useDatePicker = useMemo(() => subtype === DATETIME_SUBTYPES.DATE || subtype === DATETIME_SUBTYPES.DATETIME, [subtype]);
  const useTimePicker = useMemo(() => subtype === DATETIME_SUBTYPES.TIME || subtype === DATETIME_SUBTYPES.DATETIME, [subtype]);
  const onDateTimeBlur = useCallback(e => {
    if (e.relatedTarget && dateTimeGroupRef.current.contains(e.relatedTarget)) {
      return;
    }
    onBlur && onBlur();
  }, [onBlur]);
  const onDateTimeFocus = useCallback(e => {
    if (e.relatedTarget && dateTimeGroupRef.current.contains(e.relatedTarget)) {
      return;
    }
    onFocus && onFocus();
  }, [onFocus]);
  useEffect(() => {
    let {
      date,
      time
    } = getNullDateTime();
    switch (subtype) {
      case DATETIME_SUBTYPES.DATE:
        {
          date = new Date(Date.parse(value));
          break;
        }
      case DATETIME_SUBTYPES.TIME:
        {
          time = parseIsoTime(value);
          break;
        }
      case DATETIME_SUBTYPES.DATETIME:
        {
          date = new Date(Date.parse(value));
          time = isValidDate(date) ? 60 * date.getHours() + date.getMinutes() : null;
          break;
        }
    }
    setDateTime({
      date,
      time
    });
  }, [subtype, value]);
  const computeAndSetState = useCallback(({
    date,
    time
  }) => {
    let newDateTimeValue = null;
    if (subtype === DATETIME_SUBTYPES.DATE && isValidDate(date)) {
      newDateTimeValue = serializeDate(date);
    } else if (subtype === DATETIME_SUBTYPES.TIME && isValidTime(time)) {
      newDateTimeValue = serializeTime(time, new Date().getTimezoneOffset(), timeSerializingFormat);
    } else if (subtype === DATETIME_SUBTYPES.DATETIME && isValidDate(date) && isValidTime(time)) {
      newDateTimeValue = serializeDateTime(date, time, timeSerializingFormat);
    }
    if (value === newDateTimeValue) {
      return;
    }
    onChange({
      value: newDateTimeValue,
      field
    });
  }, [value, field, onChange, subtype, timeSerializingFormat]);
  useEffect(() => {
    if (dateTimeUpdateRequest) {
      if (dateTimeUpdateRequest.refreshOnly) {
        computeAndSetState(dateTime);
      } else {
        const newDateTime = {
          ...dateTime,
          ...dateTimeUpdateRequest
        };
        setDateTime(newDateTime);
        computeAndSetState(newDateTime);
      }
      setDateTimeUpdateRequest(null);
    }
  }, [computeAndSetState, dateTime, dateTimeUpdateRequest]);
  useEffect(() => {
    setDateTimeUpdateRequest({
      refreshOnly: true
    });
  }, [timeSerializingFormat]);
  const allErrors = useMemo(() => {
    if (required || subtype !== DATETIME_SUBTYPES.DATETIME) return errors;
    const isOnlyOneFieldSet = isValidDate(dateTime.date) && !isValidTime(dateTime.time) || !isValidDate(dateTime.date) && isValidTime(dateTime.time);
    return isOnlyOneFieldSet ? ['Pole pro datum i čas musí být vyplněné.', ...errors] : errors;
  }, [required, subtype, dateTime, errors]);
  const setDate = useCallback(date => {
    setDateTimeUpdateRequest(prev => prev ? {
      ...prev,
      date
    } : {
      date
    });
  }, []);
  const setTime = useCallback(time => {
    setDateTimeUpdateRequest(prev => prev ? {
      ...prev,
      time
    } : {
      time
    });
  }, []);
  const errorMessageId = allErrors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  const descriptionId = `${prefixId(id, formId)}-description`;
  const datePickerProps = {
    label: dateLabel,
    collapseLabelOnEmpty: !timeLabel,
    onDateTimeBlur,
    onDateTimeFocus,
    domId: `${domId}-date`,
    required,
    disabled,
    disallowPassedDates,
    date: dateTime.date,
    readonly,
    setDate,
    'aria-describedby': [descriptionId, errorMessageId].join(' ')
  };
  const timePickerProps = {
    label: timeLabel,
    collapseLabelOnEmpty: !dateLabel,
    onDateTimeBlur,
    onDateTimeFocus,
    domId: `${domId}-time`,
    required,
    disabled,
    readonly,
    use24h,
    timeInterval,
    time: dateTime.time,
    setTime,
    'aria-describedby': [descriptionId, errorMessageId].join(' ')
  };
  return jsxs("div", {
    class: formFieldClasses(type$e, {
      errors: allErrors,
      disabled,
      readonly
    }),
    children: [jsxs("div", {
      class: classNames('fjs-vertical-group'),
      ref: dateTimeGroupRef,
      children: [useDatePicker && jsx(Datepicker, {
        ...datePickerProps
      }), useTimePicker && useDatePicker && jsx("div", {
        class: "fjs-datetime-separator"
      }), useTimePicker && jsx(Timepicker, {
        ...timePickerProps
      })]
    }), jsx(Description, {
      id: descriptionId,
      description: description
    }), jsx(Errors, {
      errors: allErrors,
      id: errorMessageId
    })]
  });
}
Datetime.config = {
  type: type$e,
  keyed: true,
  label: 'Datum a čas',
  group: 'basic-input',
  emptyValue: null,
  sanitizeValue: sanitizeDateTimePickerValue,
  create: (options = {}) => {
    const defaults = {};
    set(defaults, DATETIME_SUBTYPE_PATH, DATETIME_SUBTYPES.DATE);
    set(defaults, DATE_LABEL_PATH, 'Datum');
    return {
      ...defaults,
      ...options
    };
  }
};

function Group(props) {
  const {
    field,
    domId
  } = props;
  const {
    label,
    type,
    showOutline
  } = field;
  const {
    Empty
  } = useContext(FormRenderContext);
  const fullProps = {
    ...props,
    Empty
  };
  return jsxs("div", {
    className: classNames(formFieldClasses(type), 'fjs-form-field-grouplike', {
      'fjs-outlined': showOutline
    }),
    role: "group",
    "aria-labelledby": domId,
    children: [jsx(Label, {
      id: domId,
      label: label
    }), jsx(ChildrenRenderer, {
      ...fullProps
    })]
  });
}
Group.config = {
  type: 'group',
  pathed: true,
  label: 'Skupina',
  group: 'container',
  create: (options = {}) => ({
    components: [],
    showOutline: true,
    ...options
  })
};

const type$d = 'iframe';
const DEFAULT_HEIGHT = 300;
function IFrame(props) {
  const {
    field,
    disabled,
    readonly,
    domId
  } = props;
  const {
    height = DEFAULT_HEIGHT,
    label,
    url,
    security = {}
  } = field;
  const evaluatedUrl = useSingleLineTemplateEvaluation(url, {
    debug: true
  });
  const safeUrl = useMemo(() => sanitizeIFrameSource(evaluatedUrl), [evaluatedUrl]);
  const evaluatedLabel = useSingleLineTemplateEvaluation(label, {
    debug: true
  });
  const [sandbox, allow] = useSecurityAttributesMap(security);
  const [iframeRefresh, setIframeRefresh] = useState(0);

  // forces re-render of iframe when sandbox or allow attributes change, as browsers do not do it automatically
  useEffect(() => {
    setIframeRefresh(count => count + 1);
  }, [sandbox, allow]);
  return jsxs("div", {
    class: formFieldClasses(type$d, {
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      htmlFor: domId,
      label: evaluatedLabel
    }), !evaluatedUrl && jsx(IFramePlaceholder, {
      text: "\u017D\xE1dn\xFD dostupn\xFD obsah."
    }), evaluatedUrl && safeUrl && jsx("iframe", {
      src: safeUrl,
      title: evaluatedLabel,
      height: height,
      class: "fjs-iframe",
      id: domId,
      sandbox: sandbox,
      allow
    }, 'iframe-' + iframeRefresh), evaluatedUrl && !safeUrl && jsx(IFramePlaceholder, {
      text: "External content couldn't be loaded."
    })]
  });
}
function IFramePlaceholder(props) {
  const {
    text = 'iFrame'
  } = props;
  return jsx("div", {
    class: "fjs-iframe-placeholder",
    children: jsx("p", {
      class: "fjs-iframe-placeholder-text",
      children: text
    })
  });
}
IFrame.config = {
  type: type$d,
  keyed: false,
  label: 'iFrame',
  group: 'container',
  create: (options = {}) => ({
    security: {
      allowScripts: true
    },
    ...options
  })
};

var _path$u;
function _extends$v() { _extends$v = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$v.apply(this, arguments); }
var SvgButton = function SvgButton(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$v({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$u || (_path$u = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M45 17a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V20a3 3 0 0 1 3-3h36zm-9 8.889H18v2.222h18v-2.222z"
  })));
};
var ButtonIcon = SvgButton;

var _path$t;
function _extends$u() { _extends$u = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$u.apply(this, arguments); }
var SvgCheckbox = function SvgCheckbox(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$u({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$t || (_path$t = /*#__PURE__*/React.createElement("path", {
    d: "M34 18H20a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V20a2 2 0 0 0-2-2zm-9 14-5-5 1.41-1.41L25 29.17l7.59-7.59L34 23l-9 9z"
  })));
};
var CheckboxIcon = SvgCheckbox;

var _path$s;
function _extends$t() { _extends$t = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$t.apply(this, arguments); }
var SvgChecklist = function SvgChecklist(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$t({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "none"
  }, props), _path$s || (_path$s = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    d: "M14.35 24.75H19v4.65h-4.65v-4.65Zm-1.414-1.414a2 2 0 0 1 1.414-.586H19a2 2 0 0 1 2 2v4.65a2 2 0 0 1-2 2h-4.65a2 2 0 0 1-2-2v-4.65a2 2 0 0 1 .586-1.414ZM14.35 37.05H19v4.65h-4.65v-4.65Zm-1.414-1.414a2 2 0 0 1 1.414-.586H19a2 2 0 0 1 2 2v4.65a2 2 0 0 1-2 2h-4.65a2 2 0 0 1-2-2v-4.65a2 2 0 0 1 .586-1.414ZM14.35 12.45H19v4.65h-4.65v-4.65Zm-1.414-1.414a2 2 0 0 1 1.414-.586H19a2 2 0 0 1 2 2v4.65a2 2 0 0 1-2 2h-4.65a2 2 0 0 1-2-2v-4.65a2 2 0 0 1 .586-1.414Zm12.007 14.977a1 1 0 0 0-.293.707v.65a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-.65a1 1 0 0 0-1-1h-15a1 1 0 0 0-.707.293Zm0 12.3a1 1 0 0 0-.293.707v.65a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-.65a1 1 0 0 0-1-1h-15a1 1 0 0 0-.707.293Zm0-24.6a1 1 0 0 0-.293.707v.65a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-.65a1 1 0 0 0-1-1h-15a1 1 0 0 0-.707.293Z",
    clipRule: "evenodd"
  })));
};
var ChecklistIcon = SvgChecklist;

var _path$r, _path2$3, _path3;
function _extends$s() { _extends$s = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$s.apply(this, arguments); }
var SvgDatetime = function SvgDatetime(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$s({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$r || (_path$r = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M37.908 13.418h-5.004v-2.354h-1.766v2.354H21.13v-2.354h-1.766v2.354H14.36a2.07 2.07 0 0 0-2.06 2.06v23.549a2.07 2.07 0 0 0 2.06 2.06h6.77v-1.766h-6.358a.707.707 0 0 1-.706-.706V15.89c0-.39.316-.707.706-.707h4.592v2.355h1.766v-2.355h10.008v2.355h1.766v-2.355h4.592a.71.71 0 0 1 .707.707v6.358h1.765v-6.77c0-1.133-.927-2.06-2.06-2.06z"
  })), _path2$3 || (_path2$3 = /*#__PURE__*/React.createElement("path", {
    d: "m35.13 37.603 1.237-1.237-3.468-3.475v-5.926h-1.754v6.654l3.984 3.984Z"
  })), _path3 || (_path3 = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M23.08 36.962a9.678 9.678 0 1 0 17.883-7.408 9.678 9.678 0 0 0-17.882 7.408Zm4.54-10.292a7.924 7.924 0 1 1 8.805 13.177A7.924 7.924 0 0 1 27.62 26.67Z"
  })));
};
var DatetimeIcon = SvgDatetime;

var _path$q, _path2$2;
function _extends$r() { _extends$r = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$r.apply(this, arguments); }
var SvgTaglist = function SvgTaglist(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$r({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$q || (_path$q = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M45 16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3h36Zm0 2H9a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V19a1 1 0 0 0-1-1Z"
  })), _path2$2 || (_path2$2 = /*#__PURE__*/React.createElement("path", {
    d: "M11 22a1 1 0 0 1 1-1h19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H12a1 1 0 0 1-1-1V22Z"
  })));
};
var TaglistIcon = SvgTaglist;

var _rect, _rect2, _rect3;
function _extends$q() { _extends$q = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$q.apply(this, arguments); }
var SvgForm = function SvgForm(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$q({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54
  }, props), _rect || (_rect = /*#__PURE__*/React.createElement("rect", {
    width: 24,
    height: 4,
    x: 15,
    y: 17,
    rx: 1
  })), _rect2 || (_rect2 = /*#__PURE__*/React.createElement("rect", {
    width: 24,
    height: 4,
    x: 15,
    y: 25,
    rx: 1
  })), _rect3 || (_rect3 = /*#__PURE__*/React.createElement("rect", {
    width: 13,
    height: 4,
    x: 15,
    y: 33,
    rx: 1
  })));
};
var FormIcon = SvgForm;

var _path$p;
function _extends$p() { _extends$p = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$p.apply(this, arguments); }
var SvgGroup = function SvgGroup(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$p({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "none"
  }, props), _path$p || (_path$p = /*#__PURE__*/React.createElement("path", {
    fill: "#000",
    fillRule: "evenodd",
    d: "M4.05 42.132v1.164c0 .693.604 1.254 1.35 1.254h1.35v-2.507h-2.7v.09Zm0-2.328h2.7v-2.328h-2.7v2.328Zm0-4.656h2.7V32.82h-2.7v2.328Zm0-4.656h2.7v-2.328h-2.7v2.328Zm0-4.656h2.7v-2.328h-2.7v2.328Zm0-4.656h2.7v-2.328h-2.7v2.328Zm0-4.656h2.7v-2.328h-2.7v2.328Zm0-4.656v.09h2.7V9.45H5.4c-.746 0-1.35.561-1.35 1.254v1.164Zm5.4-2.418v2.507h2.7V9.45h-2.7Zm5.4 0v2.507h2.7V9.45h-2.7Zm5.4 0v2.507h2.7V9.45h-2.7Zm5.4 0v2.507h2.7V9.45h-2.7Zm5.4 0v2.507h2.7V9.45h-2.7Zm5.4 0v2.507h2.7V9.45h-2.7Zm5.4 0v2.507h2.7V9.45h-2.7Zm5.4 0v2.507h2.7v-1.253c0-.693-.604-1.254-1.35-1.254h-1.35Zm2.7 4.746h-2.7v2.328h2.7v-2.328Zm0 4.656h-2.7v2.328h2.7v-2.328Zm0 4.656h-2.7v2.328h2.7v-2.328Zm0 4.656h-2.7v2.328h2.7v-2.328Zm0 4.656h-2.7v2.328h2.7V32.82Zm0 4.656h-2.7v2.328h2.7v-2.328Zm0 4.656v-.09h-2.7v2.508h1.35c.746 0 1.35-.561 1.35-1.254v-1.164Zm-5.4 2.418v-2.507h-2.7v2.507h2.7Zm-5.4 0v-2.507h-2.7v2.507h2.7Zm-5.4 0v-2.507h-2.7v2.507h2.7Zm-5.4 0v-2.507h-2.7v2.507h2.7Zm-5.4 0v-2.507h-2.7v2.507h2.7Zm-5.4 0v-2.507h-2.7v2.507h2.7Zm-5.4 0v-2.507h-2.7v2.507h2.7Z",
    clipRule: "evenodd"
  })));
};
var GroupIcon = SvgGroup;

var _path$o;
function _extends$o() { _extends$o = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$o.apply(this, arguments); }
var SvgNumber = function SvgNumber(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$o({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$o || (_path$o = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M45 16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3h36zm0 2H9a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V19a1 1 0 0 0-1-1zM35 28.444h7l-3.5 4-3.5-4zM35 26h7l-3.5-4-3.5 4z"
  })));
};
var NumberIcon = SvgNumber;

var _path$n;
function _extends$n() { _extends$n = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$n.apply(this, arguments); }
var SvgRadio = function SvgRadio(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$n({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$n || (_path$n = /*#__PURE__*/React.createElement("path", {
    d: "M27 22c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm0 18a8 8 0 1 1 0-16 8 8 0 1 1 0 16z"
  })));
};
var RadioIcon = SvgRadio;

var _path$m;
function _extends$m() { _extends$m = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$m.apply(this, arguments); }
var SvgSelect = function SvgSelect(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$m({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$m || (_path$m = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M45 16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3h36zm0 2H9a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V19a1 1 0 0 0-1-1zm-12 7h9l-4.5 6-4.5-6z"
  })));
};
var SelectIcon = SvgSelect;

var _path$l;
function _extends$l() { _extends$l = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$l.apply(this, arguments); }
var SvgSeparator = function SvgSeparator(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$l({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "none"
  }, props), _path$l || (_path$l = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "M26.293 16.293a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1-1.414 1.414L27 18.414l-3.293 3.293a1 1 0 0 1-1.414-1.414l4-4ZM9 26h36v2H9v-2Zm13.293 7.707 4 4a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L27 35.586l-3.293-3.293a1 1 0 0 0-1.414 1.414Z"
  })));
};
var SeparatorIcon = SvgSeparator;

var _path$k;
function _extends$k() { _extends$k = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$k.apply(this, arguments); }
var SvgSpacer = function SvgSpacer(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$k({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "none"
  }, props), _path$k || (_path$k = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "M9 15v2h36v-2H9Zm0 22v2h36v-2H9Zm17.293-17.707a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1-1.414 1.414L27 21.414l-3.293 3.293a1 1 0 0 1-1.414-1.414l4-4Zm-4 11.414 4 4a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L27 32.586l-3.293-3.293a1 1 0 0 0-1.414 1.414Z"
  })));
};
var SpacerIcon = SvgSpacer;

var _path$j;
function _extends$j() { _extends$j = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$j.apply(this, arguments); }
var SvgDynamicList = function SvgDynamicList(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$j({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "none"
  }, props), _path$j || (_path$j = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    d: "M2.7 43.296v1.254c0 .746.604 1.35 1.35 1.35h1.275v-1.795c.049.14.075.29.075.445v-1.254h-.075V43.2H4.05c.177 0 .347.034.502.096H2.7Zm2.7-2.507v-2.507H2.7v2.507h2.7Zm0-5.014v-2.507H2.7v2.507h2.7Zm0-5.014v-2.507H2.7v2.507h2.7Zm0-5.015V23.24H2.7v2.507h2.7Zm0-5.014v-2.507H2.7v2.507h2.7Zm0-5.014V13.21H2.7v2.507h2.7Zm-2.7-5.014h1.852a1.346 1.346 0 0 1-.502.096h1.275v-.096H5.4V9.45c0 .156-.026.306-.075.445V8.1H4.05A1.35 1.35 0 0 0 2.7 9.45v1.254Zm5.175.096h2.55V8.1h-2.55v2.7Zm5.1 0h2.55V8.1h-2.55v2.7Zm5.1 0h2.55V8.1h-2.55v2.7Zm5.1 0h2.55V8.1h-2.55v2.7Zm5.1 0h2.55V8.1h-2.55v2.7Zm5.1 0h2.55V8.1h-2.55v2.7Zm5.1 0h2.55V8.1h-2.55v2.7Zm5.1 0h2.55V8.1h-2.55v2.7Zm5.1-2.7v1.795a1.348 1.348 0 0 1-.075-.445v1.254h.075v.096h1.275a1.35 1.35 0 0 1-.502-.096H51.3V9.45a1.35 1.35 0 0 0-1.35-1.35h-1.275Zm-.075 5.11v2.508h2.7V13.21h-2.7Zm0 5.015v2.507h2.7v-2.507h-2.7Zm0 5.014v2.507h2.7V23.24h-2.7Zm0 5.015v2.507h2.7v-2.507h-2.7Zm0 5.014v2.507h2.7v-2.507h-2.7Zm0 5.014v2.507h2.7v-2.507h-2.7Zm2.7 5.014h-1.852a1.35 1.35 0 0 1 .502-.096h-1.275v.096H48.6v1.254c0-.156.026-.305.075-.445V45.9h1.275a1.35 1.35 0 0 0 1.35-1.35v-1.254Zm-5.175-.096h-2.55v2.7h2.55v-2.7Zm-5.1 0h-2.55v2.7h2.55v-2.7Zm-5.1 0h-2.55v2.7h2.55v-2.7Zm-5.1 0h-2.55v2.7h2.55v-2.7Zm-5.1 0h-2.55v2.7h2.55v-2.7Zm-5.1 0h-2.55v2.7h2.55v-2.7Zm-5.1 0h-2.55v2.7h2.55v-2.7Zm-5.1 0h-2.55v2.7h2.55v-2.7ZM16.2 17.55a4.05 4.05 0 0 1 4.05 4.05v1.35A4.05 4.05 0 0 1 16.2 27h-1.35a4.05 4.05 0 0 1-4.05-4.05V21.6a4.05 4.05 0 0 1 4.05-4.05h1.35Zm0 2.7h-1.35a1.35 1.35 0 0 0-1.35 1.35v1.35c0 .746.604 1.35 1.35 1.35h1.35a1.35 1.35 0 0 0 1.35-1.35V21.6a1.35 1.35 0 0 0-1.35-1.35Zm27 1.35a4.05 4.05 0 0 0-4.05-4.05H29.7a4.05 4.05 0 0 0-4.05 4.05v1.35A4.05 4.05 0 0 0 29.7 27h9.45a4.05 4.05 0 0 0 4.05-4.05V21.6Zm-13.5-1.35h9.45c.746 0 1.35.604 1.35 1.35v1.35a1.35 1.35 0 0 1-1.35 1.35H29.7a1.35 1.35 0 0 1-1.35-1.35V21.6c0-.746.604-1.35 1.35-1.35ZM43.2 37.8a4.05 4.05 0 0 0-4.05-4.05H29.7a4.05 4.05 0 0 0-4.05 4.05v1.35h2.7V37.8c0-.746.604-1.35 1.35-1.35h9.45c.746 0 1.35.604 1.35 1.35v1.35h2.7V37.8Zm-27-4.05a4.05 4.05 0 0 1 4.05 4.05v1.35h-2.7V37.8a1.35 1.35 0 0 0-1.35-1.35h-1.35a1.35 1.35 0 0 0-1.35 1.35v1.35h-2.7V37.8a4.05 4.05 0 0 1 4.05-4.05h1.35Z",
    clipRule: "evenodd"
  })));
};
var DynamicListIcon = SvgDynamicList;

var _path$i;
function _extends$i() { _extends$i = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$i.apply(this, arguments); }
var SvgText = function SvgText(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$i({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$i || (_path$i = /*#__PURE__*/React.createElement("path", {
    d: "M20.58 33.77h-3l-1.18-3.08H11l-1.1 3.08H7l5.27-13.54h2.89zm-5-5.36-1.86-5-1.83 5zM22 20.23h5.41a15.47 15.47 0 0 1 2.4.14 3.42 3.42 0 0 1 1.41.55 3.47 3.47 0 0 1 1 1.14 3 3 0 0 1 .42 1.58 3.26 3.26 0 0 1-1.91 2.94 3.63 3.63 0 0 1 1.91 1.22 3.28 3.28 0 0 1 .66 2 4 4 0 0 1-.43 1.8 3.63 3.63 0 0 1-1.09 1.4 3.89 3.89 0 0 1-1.83.65q-.69.07-3.3.09H22zm2.73 2.25v3.13h3.8a1.79 1.79 0 0 0 1.1-.49 1.41 1.41 0 0 0 .41-1 1.49 1.49 0 0 0-.35-1 1.54 1.54 0 0 0-1-.48c-.27 0-1.05-.05-2.34-.05zm0 5.39v3.62h2.57a11.52 11.52 0 0 0 1.88-.09 1.65 1.65 0 0 0 1-.54 1.6 1.6 0 0 0 .38-1.14 1.75 1.75 0 0 0-.29-1 1.69 1.69 0 0 0-.86-.62 9.28 9.28 0 0 0-2.41-.23zm19.62.92 2.65.84a5.94 5.94 0 0 1-2 3.29A5.74 5.74 0 0 1 41.38 34a5.87 5.87 0 0 1-4.44-1.84 7.09 7.09 0 0 1-1.73-5A7.43 7.43 0 0 1 37 21.87 6 6 0 0 1 41.54 20a5.64 5.64 0 0 1 4 1.47A5.33 5.33 0 0 1 47 24l-2.7.65a2.8 2.8 0 0 0-2.86-2.27A3.09 3.09 0 0 0 39 23.42a5.31 5.31 0 0 0-.93 3.5 5.62 5.62 0 0 0 .93 3.65 3 3 0 0 0 2.4 1.09 2.72 2.72 0 0 0 1.82-.66 4 4 0 0 0 1.13-2.21z"
  })));
};
var TextIcon = SvgText;

var _path$h;
function _extends$h() { _extends$h = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$h.apply(this, arguments); }
var SvgHtml = function SvgHtml(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$h({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "none"
  }, props), _path$h || (_path$h = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    d: "M47.008 12.15c1.625 0 2.942 1.36 2.942 3.039v23.622c0 1.678-1.317 3.039-2.942 3.039H6.992c-1.625 0-2.942-1.36-2.942-3.039V15.189c0-1.678 1.317-3.039 2.942-3.039h40.016Zm0 2.026H6.992c-.542 0-.98.454-.98 1.013V16.2h-.004v2.7h.003v19.911c0 .56.44 1.013.98 1.013h40.017c.542 0 .98-.453.98-1.013V18.9h.005v-2.7h-.004v-1.011c0-.56-.44-1.013-.98-1.013ZM14.934 26.055v-3.78h2.194v9.45h-2.194v-3.78h-3.29v3.78H9.45v-9.45h2.194v3.78h3.29Zm4.388-1.89h2.194v7.56h2.193v-7.56h2.194v-1.89h-6.581v1.89Zm14.26-1.89h2.193v9.45h-2.194V25.11l-1.645 3.78-1.645-3.78v6.615h-2.194v-9.45h2.194l1.645 3.78 1.645-3.78Zm4.387 0h2.194v7.56h4.387v1.89h-6.581v-9.45Z",
    clipRule: "evenodd"
  })));
};
var HTMLIcon = SvgHtml;

var _path$g;
function _extends$g() { _extends$g = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$g.apply(this, arguments); }
var SvgExpressionField = function SvgExpressionField(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$g({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "none"
  }, props), _path$g || (_path$g = /*#__PURE__*/React.createElement("path", {
    fill: "currentcolor",
    fillRule: "evenodd",
    d: "M12.78 16.2v6.75c0 1.619-.635 3.059-1.618 4.05.983.991 1.618 2.431 1.618 4.05v6.75h3.51v2.7h-3.51c-1.289 0-2.34-1.213-2.34-2.7v-6.75c0-1.487-1.051-2.7-2.34-2.7v-2.7c1.289 0 2.34-1.213 2.34-2.7V16.2c0-1.487 1.051-2.7 2.34-2.7h3.51v2.7h-3.51Zm30.78 0v6.75c0 1.487 1.051 2.7 2.34 2.7v2.7c-1.289 0-2.34 1.213-2.34 2.7v6.75c0 1.487-1.051 2.7-2.34 2.7h-3.51v-2.7h3.51v-6.75c0-1.619.635-3.059 1.618-4.05-.983-.991-1.618-2.431-1.618-4.05V16.2h-3.51v-2.7h3.51c1.289 0 2.34 1.213 2.34 2.7ZM21.8 34.531c.467-.379.787-.965.959-1.758l1.788-8.34h1.585l.387-1.828h-1.585l.405-1.878h1.585l.387-1.827H25.69c-.847 0-1.505.19-1.972.569-.454.379-.768.965-.94 1.758l-.294 1.378H21.34l-.387 1.827h1.142l-1.898 8.841h-1.585l-.387 1.827h1.622c.848 0 1.499-.19 1.953-.569Zm7.248-7.686-3.797 4.808h2.599l2.12-3.016h.22l.885 3.016h2.599l-1.677-4.36 3.778-4.688h-2.599l-2.12 2.947h-.22l-.885-2.947h-2.599l1.696 4.24Z",
    clipRule: "evenodd"
  })));
};
var ExpressionFieldIcon = SvgExpressionField;

var _path$f;
function _extends$f() { _extends$f = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$f.apply(this, arguments); }
var SvgTextfield = function SvgTextfield(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$f({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$f || (_path$f = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M45 16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3h36zm0 2H9a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V19a1 1 0 0 0-1-1zm-32 4v10h-2V22h2z"
  })));
};
var TextfieldIcon = SvgTextfield;

var _path$e;
function _extends$e() { _extends$e = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$e.apply(this, arguments); }
var SvgTextarea = function SvgTextarea(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$e({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$e || (_path$e = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M45 13a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V16a3 3 0 0 1 3-3h36zm0 2H9a1 1 0 0 0-1 1v22a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V16a1 1 0 0 0-1-1zm-1.136 15.5.849.849-6.364 6.364-.849-.849 6.364-6.364zm.264 3.5.849.849-2.828 2.828-.849-.849L44.128 34zM13 19v10h-2V19h2z"
  })));
};
var TextareaIcon = SvgTextarea;

var _path$d;
function _extends$d() { _extends$d = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$d.apply(this, arguments); }
var SvgIFrame = function SvgIFrame(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$d({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "none"
  }, props), _path$d || (_path$d = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    d: "M45.658 9.45c1.625 0 2.942 1.36 2.942 3.039V22.95h-1.961v-4.383H7.36V41.51c0 .56.44 1.013.98 1.013H27v2.026H8.342c-1.625 0-2.942-1.36-2.942-3.039V12.489c0-1.678 1.317-3.039 2.942-3.039h37.316Zm0 2.026H8.342c-.542 0-.98.454-.98 1.013v4.052h39.277v-4.052c0-.56-.44-1.013-.98-1.013ZM31.05 35.775A8.768 8.768 0 0 1 39.825 27a8.768 8.768 0 0 1 8.775 8.775 8.768 8.768 0 0 1-8.775 8.775 8.768 8.768 0 0 1-8.775-8.775Zm12.388-.516h3.097c-.206-2.581-1.858-4.646-4.026-5.678.62 1.548.93 3.613.93 5.678Zm-5.162 2.065c.207 3.303 1.136 4.955 1.549 5.161.413-.206 1.239-1.858 1.445-5.161h-2.994Zm1.446-8.26c-.31.207-1.342 2.272-1.446 6.195h2.994c-.103-3.923-1.135-5.988-1.548-6.194Zm-3.51 6.195c.103-2.065.31-4.13.929-5.678-2.168 1.032-3.82 3.097-4.026 5.678h3.097Zm0 2.065h-2.89c.515 2.064 1.96 3.82 3.819 4.645-.516-1.342-.826-2.994-.93-4.645Zm7.226 0c-.103 1.755-.413 3.303-.929 4.645 1.858-.826 3.304-2.58 3.923-4.645h-2.994Z",
    clipRule: "evenodd"
  })));
};
var IFrameIcon = SvgIFrame;

var _path$c, _path2$1;
function _extends$c() { _extends$c = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$c.apply(this, arguments); }
var SvgImage = function SvgImage(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$c({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$c || (_path$c = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M34.636 21.91A3.818 3.818 0 1 1 27 21.908a3.818 3.818 0 0 1 7.636 0Zm-2 0A1.818 1.818 0 1 1 29 21.908a1.818 1.818 0 0 1 3.636 0Z",
    clipRule: "evenodd"
  })), _path2$1 || (_path2$1 = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M15 13a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V15a2 2 0 0 0-2-2H15Zm24 2H15v12.45l4.71-4.709a1.91 1.91 0 0 1 2.702 0l6.695 6.695 2.656-1.77a1.91 1.91 0 0 1 2.411.239L39 32.73V15ZM15 39v-8.754a.975.975 0 0 0 .168-.135l5.893-5.893 6.684 6.685a1.911 1.911 0 0 0 2.41.238l2.657-1.77 6.02 6.02c.052.051.108.097.168.135V39H15Z",
    clipRule: "evenodd"
  })));
};
var ImageIcon = SvgImage;

var _path$b;
function _extends$b() { _extends$b = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$b.apply(this, arguments); }
var SvgTable = function SvgTable(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$b({
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    viewBox: "0 0 54 54"
  }, props), _path$b || (_path$b = /*#__PURE__*/React.createElement("path", {
    fill: "currentcolor",
    fillRule: "evenodd",
    d: "M42.545 12.273A2.455 2.455 0 0 1 45 14.727v24.546a2.455 2.455 0 0 1-2.455 2.454h-31.09A2.455 2.455 0 0 1 9 39.273V14.727a2.455 2.455 0 0 1 2.455-2.454zM27.818 40.09h14.727a.818.818 0 0 0 .819-.818v-4.91H27.818Zm-1.636-5.727v5.727H11.455a.818.818 0 0 1-.819-.818v-4.91zm1.636-1.637h15.546V27H27.818ZM26.182 27v5.727H10.636V27zm1.636-1.636h15.546v-5.728H27.818Zm-1.636-5.728v5.728H10.636v-5.728z",
    clipRule: "evenodd"
  })));
};
var TableIcon = SvgTable;

const iconsByType = type => {
  return {
    button: ButtonIcon,
    checkbox: CheckboxIcon,
    checklist: ChecklistIcon,
    columns: GroupIcon,
    datetime: DatetimeIcon,
    group: GroupIcon,
    iframe: IFrameIcon,
    image: ImageIcon,
    number: NumberIcon,
    expression: ExpressionFieldIcon,
    radio: RadioIcon,
    select: SelectIcon,
    separator: SeparatorIcon,
    spacer: SpacerIcon,
    dynamiclist: DynamicListIcon,
    taglist: TaglistIcon,
    text: TextIcon,
    html: HTMLIcon,
    textfield: TextfieldIcon,
    textarea: TextareaIcon,
    table: TableIcon,
    default: FormIcon
  }[type];
};

const type$c = 'image';
function Image(props) {
  const {
    field
  } = props;
  const {
    alt,
    id,
    source
  } = field;
  const Icon = iconsByType(field.type);
  const evaluatedImageSource = useSingleLineTemplateEvaluation(source, {
    debug: true
  });
  const safeSource = useMemo(() => sanitizeImageSource(evaluatedImageSource), [evaluatedImageSource]);
  const altText = useSingleLineTemplateEvaluation(alt, {
    debug: true
  });
  const {
    formId
  } = useContext(FormContext);
  return jsxs("div", {
    class: formFieldClasses(type$c),
    children: [safeSource && jsx("div", {
      class: "fjs-image-container",
      children: jsx("img", {
        alt: altText,
        src: safeSource,
        class: "fjs-image",
        id: prefixId(id, formId)
      })
    }), !safeSource && jsx("div", {
      class: "fjs-image-placeholder",
      children: jsx("span", {
        class: "fjs-image-placeholder-inner",
        children: jsx(Icon, {
          alt: "This is an image placeholder",
          width: "32",
          height: "32",
          viewBox: "0 0 56 56"
        })
      })
    })]
  });
}
Image.config = {
  type: type$c,
  keyed: false,
  label: 'Obrázek',
  group: 'presentation',
  create: (options = {}) => ({
    ...options
  })
};

function TemplatedInputAdorner(props) {
  const {
    pre,
    post
  } = props;
  const evaluatedPre = useSingleLineTemplateEvaluation(pre, {
    debug: true
  });
  const evaluatedPost = useSingleLineTemplateEvaluation(post, {
    debug: true
  });
  return jsx(InputAdorner, {
    ...props,
    pre: evaluatedPre,
    post: evaluatedPost
  });
}

var _path$a;
function _extends$a() { _extends$a = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$a.apply(this, arguments); }
var SvgAngelDown = function SvgAngelDown(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$a({
    xmlns: "http://www.w3.org/2000/svg",
    width: 8,
    height: 8
  }, props), _path$a || (_path$a = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    stroke: "currentColor",
    strokeWidth: 0.5,
    d: "M7.75 1.336 4 6.125.258 1.335 0 1.54l4 5.125L8 1.54Zm0 0",
    clipRule: "evenodd"
  })));
};
var AngelDownIcon = SvgAngelDown;

var _path$9;
function _extends$9() { _extends$9 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$9.apply(this, arguments); }
var SvgAngelUp = function SvgAngelUp(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$9({
    xmlns: "http://www.w3.org/2000/svg",
    width: 8,
    height: 8
  }, props), _path$9 || (_path$9 = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    stroke: "currentColor",
    strokeWidth: 0.5,
    d: "M7.75 6.664 4 1.875.258 6.665 0 6.46l4-5.125L8 6.46Zm0 0",
    clipRule: "evenodd"
  })));
};
var AngelUpIcon = SvgAngelUp;

function countDecimals(number) {
  const num = Big(number);
  if (num.toString() === num.toFixed(0)) return 0;
  return num.toFixed().split('.')[1].length || 0;
}
function isValidNumber(value) {
  return (typeof value === 'number' || typeof value === 'string') && value !== '' && !isNaN(Number(value));
}
function willKeyProduceValidNumber(key, previousValue, caretIndex, selectionWidth, decimalDigits) {
  if (previousValue === 'NaN') {
    return false;
  }

  // Dot and comma are both treated as dot
  previousValue = previousValue.replace(',', '.');
  const isFirstDot = !previousValue.includes('.') && (key === '.' || key === ',');
  const isFirstMinus = !previousValue.includes('-') && key === '-' && caretIndex === 0;
  const keypressIsNumeric = /^[0-9]$/i.test(key);
  const dotIndex = previousValue === undefined ? -1 : previousValue.indexOf('.');

  // If the caret is positioned after a dot, and the current decimal digits count is equal or greater to the maximum, disallow the key press
  const overflowsDecimalSpace = typeof decimalDigits === 'number' && selectionWidth === 0 && dotIndex !== -1 && previousValue.includes('.') && previousValue.split('.')[1].length >= decimalDigits && caretIndex > dotIndex;
  const keypressIsAllowedChar = keypressIsNumeric || decimalDigits !== 0 && isFirstDot || isFirstMinus;
  return keypressIsAllowedChar && !overflowsDecimalSpace;
}
function isNullEquivalentValue(value) {
  return value === undefined || value === null || value === '';
}

const type$b = 'number';
function Numberfield(props) {
  const {
    disabled,
    errors = [],
    domId,
    onBlur,
    onFocus,
    field,
    value,
    readonly
  } = props;
  const {
    description,
    label,
    appearance = {},
    validate = {},
    decimalDigits,
    increment: incrementValue
  } = field;
  const {
    prefixAdorner,
    suffixAdorner
  } = appearance;
  const {
    required
  } = validate;
  const inputRef = useRef();
  const [cachedValue, setCachedValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(value);
  const sanitize = useCallback(value => Numberfield.config.sanitizeValue({
    value,
    formField: field
  }), [field]);
  const [debouncedOnChange, flushOnChange] = useFlushDebounce(props.onChange);
  const previousCachedValue = usePrevious(value);
  if (previousCachedValue !== cachedValue) {
    debouncedOnChange({
      field,
      value: cachedValue
    });
  }
  const onInputBlur = () => {
    flushOnChange && flushOnChange();
    onBlur && onBlur();
  };
  const onInputFocus = () => {
    onFocus && onFocus();
  };

  // all value changes must go through this function
  const setValue = useCallback(stringValue => {
    if (isNullEquivalentValue(stringValue)) {
      setDisplayValue('');
      setCachedValue(null);
      return;
    }

    // converts automatically for countries where the comma is used as a decimal separator
    stringValue = stringValue.replaceAll(',', '.');
    if (stringValue === '-') {
      setDisplayValue('-');
      return;
    }

    // provides feedback for invalid numbers entered via pasting as opposed to just ignoring the paste
    if (isNaN(Number(stringValue))) {
      setDisplayValue('NaN');
      setCachedValue(null);
      return;
    }
    setDisplayValue(stringValue);
    setCachedValue(sanitize(stringValue));
  }, [sanitize]);

  // when external changes occur independently of the input, we update the display and cache values of the component
  const previousValue = usePrevious(value);
  const outerValueChanged = previousValue != value;
  const outerValueEqualsCache = sanitize(value) === sanitize(cachedValue);
  if (outerValueChanged && !outerValueEqualsCache) {
    setValue(value && value.toString() || '');
  }

  // caches the value an increment/decrement operation will be based on
  const incrementAmount = useMemo(() => {
    if (incrementValue) return Big(incrementValue);
    if (decimalDigits) return Big(`1e-${decimalDigits}`);
    return Big('1');
  }, [decimalDigits, incrementValue]);
  const increment = () => {
    if (readonly) {
      return;
    }
    const base = isValidNumber(cachedValue) ? Big(cachedValue) : Big(0);
    const stepFlooredValue = base.minus(base.mod(incrementAmount));

    // note: toFixed() behaves differently in big.js
    setValue(stepFlooredValue.plus(incrementAmount).toFixed());
  };
  const decrement = () => {
    if (readonly) {
      return;
    }
    const base = isValidNumber(cachedValue) ? Big(cachedValue) : Big(0);
    const offset = base.mod(incrementAmount);
    if (offset.cmp(0) === 0) {
      // if we're already on a valid step, decrement
      setValue(base.minus(incrementAmount).toFixed());
    } else {
      // otherwise floor to the step
      const stepFlooredValue = base.minus(base.mod(incrementAmount));
      setValue(stepFlooredValue.toFixed());
    }
  };
  const onKeyDown = e => {
    // delete the NaN state all at once on backspace or delete
    if (displayValue === 'NaN' && (e.code === 'Backspace' || e.code === 'Delete')) {
      setValue('');
      e.preventDefault();
      return;
    }
    if (e.code === 'ArrowUp') {
      increment();
      e.preventDefault();
      return;
    }
    if (e.code === 'ArrowDown') {
      decrement();
      e.preventDefault();
      return;
    }
  };

  // intercept key presses which would lead to an invalid number
  const onKeyPress = e => {
    const caretIndex = inputRef.current.selectionStart;
    const selectionWidth = inputRef.current.selectionStart - inputRef.current.selectionEnd;
    const previousValue = inputRef.current.value;
    if (!willKeyProduceValidNumber(e.key, previousValue, caretIndex, selectionWidth, decimalDigits)) {
      e.preventDefault();
    }
  };
  const descriptionId = `${domId}-description`;
  const errorMessageId = `${domId}-error-message`;
  return jsxs("div", {
    class: formFieldClasses(type$b, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      htmlFor: domId,
      label: label,
      required: required
    }), jsx(TemplatedInputAdorner, {
      disabled: disabled,
      readonly: readonly,
      pre: prefixAdorner,
      post: suffixAdorner,
      children: jsxs("div", {
        class: classNames('fjs-vertical-group', {
          'fjs-disabled': disabled,
          'fjs-readonly': readonly
        }, {
          'hasErrors': errors.length
        }),
        children: [jsx("input", {
          ref: inputRef,
          class: "fjs-input",
          disabled: disabled,
          readOnly: readonly,
          id: domId,
          onKeyDown: onKeyDown,
          onKeyPress: onKeyPress,
          onBlur: onInputBlur,
          onFocus: onInputFocus

          // @ts-ignore
          ,
          onInput: e => setValue(e.target.value, true),
          onPaste: e => displayValue === 'NaN' && e.preventDefault(),
          type: "text",
          autoComplete: "off",
          step: incrementAmount,
          value: displayValue,
          "aria-describedby": [descriptionId, errorMessageId].join(' '),
          required: required,
          "aria-invalid": errors.length > 0
        }), jsxs("div", {
          class: classNames('fjs-number-arrow-container', {
            'fjs-disabled': disabled,
            'fjs-readonly': readonly
          }),
          children: [jsx("button", {
            type: "button",
            class: "fjs-number-arrow-up",
            "aria-label": "Increment",
            onClick: () => increment(),
            tabIndex: -1,
            children: jsx(AngelUpIcon, {})
          }), jsx("div", {
            class: "fjs-number-arrow-separator"
          }), jsx("button", {
            type: "button",
            class: "fjs-number-arrow-down",
            "aria-label": "Decrement",
            onClick: () => decrement(),
            tabIndex: -1,
            children: jsx(AngelDownIcon, {})
          })]
        })]
      })
    }), jsx(Description, {
      id: descriptionId,
      description: description
    }), jsx(Errors, {
      id: errorMessageId,
      errors: errors
    })]
  });
}
Numberfield.config = {
  type: type$b,
  keyed: true,
  label: 'Číslo',
  group: 'basic-input',
  emptyValue: null,
  sanitizeValue: ({
    value,
    formField
  }) => {
    // invalid value types are sanitized to null
    if (isNullEquivalentValue(value) || !isValidNumber(value)) return null;

    // otherwise, we return a string or a number depending on the form field configuration
    return formField.serializeToString ? value.toString() : Number(value);
  },
  create: (options = {}) => ({
    ...options
  })
};

const type$a = 'radio';
function Radio(props) {
  const {
    disabled,
    errors = [],
    domId,
    onBlur,
    onFocus,
    field,
    readonly,
    value
  } = props;
  const {
    description,
    label,
    validate = {}
  } = field;
  const outerDivRef = useRef();
  const {
    required
  } = validate;
  const onChange = v => {
    props.onChange({
      field,
      value: v
    });
  };
  const onRadioBlur = e => {
    if (outerDivRef.current.contains(e.relatedTarget)) {
      return;
    }
    onBlur && onBlur();
  };
  const onRadioFocus = e => {
    if (outerDivRef.current.contains(e.relatedTarget)) {
      return;
    }
    onFocus && onFocus();
  };
  const {
    loadState,
    options
  } = useOptionsAsync(field);
  useCleanupSingleSelectValue({
    field,
    loadState,
    options,
    value,
    onChange: props.onChange
  });
  const descriptionId = `${domId}-description`;
  const errorMessageId = `${domId}-error-message`;
  return jsxs("div", {
    class: formFieldClasses(type$a, {
      errors,
      disabled,
      readonly
    }),
    ref: outerDivRef,
    children: [jsx(Label, {
      label: label,
      required: required
    }), loadState == LOAD_STATES.LOADED && options.map((option, index) => {
      const itemDomId = `${domId}-${index}`;
      const isChecked = isEqual(option.value, value);
      return jsx(Label, {
        htmlFor: itemDomId,
        label: option.label,
        class: classNames({
          'fjs-checked': isChecked
        }),
        required: false,
        children: jsx("input", {
          checked: isChecked,
          class: "fjs-input",
          disabled: disabled,
          readOnly: readonly,
          id: itemDomId,
          type: "radio",
          onClick: () => onChange(option.value),
          onBlur: onRadioBlur,
          onFocus: onRadioFocus,
          "aria-describedby": [descriptionId, errorMessageId].join(' '),
          required: required,
          "aria-invalid": errors.length > 0
        })
      }, index);
    }), jsx(Description, {
      id: descriptionId,
      description: description
    }), jsx(Errors, {
      id: errorMessageId,
      errors: errors
    })]
  });
}
Radio.config = {
  type: type$a,
  keyed: true,
  label: 'Výběr z možností',
  group: 'selection',
  emptyValue: null,
  sanitizeValue: sanitizeSingleSelectValue,
  create: createEmptyOptions
};

var _path$8;
function _extends$8() { _extends$8 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$8.apply(this, arguments); }
var SvgXMark = function SvgXMark(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$8({
    xmlns: "http://www.w3.org/2000/svg",
    width: 8,
    height: 8
  }, props), _path$8 || (_path$8 = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    stroke: "currentColor",
    strokeWidth: 0.5,
    d: "M4 3.766 7.43.336l.234.234L4.234 4l3.43 3.43-.234.234L4 4.234.57 7.664.336 7.43 3.766 4 .336.57.57.336Zm0 0",
    clipRule: "evenodd"
  })));
};
var XMarkIcon = SvgXMark;

function SearchableSelect(props) {
  const {
    domId,
    disabled,
    errors,
    onBlur,
    onFocus,
    field,
    readonly,
    value
  } = props;
  const [filter, setFilter] = useState('');
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const [isFilterActive, setIsFilterActive] = useState(true);
  const [isEscapeClosed, setIsEscapeClose] = useState(false);
  const searchbarRef = useRef();
  const eventBus = useService('eventBus');
  const {
    loadState,
    options
  } = useOptionsAsync(field);
  useCleanupSingleSelectValue({
    field,
    loadState,
    options,
    value,
    onChange: props.onChange
  });
  const getLabelCorrelation = useGetLabelCorrelation(options);
  const label = useMemo(() => value && getLabelCorrelation(value), [value, getLabelCorrelation]);

  // whenever we change the underlying value, set the label to it
  useEffect(() => {
    setFilter(label || '');
  }, [label]);
  const filteredOptions = useMemo(() => {
    if (loadState !== LOAD_STATES.LOADED) {
      return [];
    }
    if (!filter || !isFilterActive) {
      return options;
    }
    return options.filter(o => o.label && o.value && o.label.toLowerCase().includes(filter.toLowerCase()));
  }, [filter, loadState, options, isFilterActive]);
  const setValue = useCallback(option => {
    setFilter(option && option.label || '');
    props.onChange({
      value: option && option.value || null,
      field
    });
  }, [field, props]);
  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded && !isEscapeClosed;
    return ds;
  }, [disabled, isDropdownExpanded, isEscapeClosed, loadState, readonly, value]);
  const onAngelMouseDown = useCallback(e => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(!isDropdownExpanded);
    const searchbar = searchbarRef.current;
    isDropdownExpanded ? searchbar.blur() : searchbar.focus();
    e.preventDefault();
  }, [isDropdownExpanded]);
  const onInputChange = ({
    target
  }) => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(true);
    setIsFilterActive(true);
    setFilter(target.value || '');
    eventBus.fire('formField.search', {
      formField: field,
      value: target.value || ''
    });
  };
  const onInputKeyDown = useCallback(keyDownEvent => {
    switch (keyDownEvent.key) {
      case 'ArrowUp':
        keyDownEvent.preventDefault();
        break;
      case 'ArrowDown':
        {
          if (!isDropdownExpanded) {
            setIsDropdownExpanded(true);
            setIsFilterActive(false);
          }
          keyDownEvent.preventDefault();
          break;
        }
      case 'Escape':
        setIsEscapeClose(true);
        break;
      case 'Enter':
        if (isEscapeClosed) {
          setIsEscapeClose(false);
        }
        break;
    }
  }, [isDropdownExpanded, isEscapeClosed]);
  const onInputMouseDown = useCallback(() => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(true);
    setIsFilterActive(false);
  }, []);
  const onInputFocus = useCallback(() => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(true);
    onFocus && onFocus();
  }, [onFocus]);
  const onInputBlur = useCallback(() => {
    setIsDropdownExpanded(false);
    setFilter(label || '');
    onBlur && onBlur();
  }, [onBlur, label]);
  return jsxs(Fragment, {
    children: [jsxs("div", {
      class: classNames('fjs-input-group', {
        'disabled': disabled,
        'readonly': readonly
      }, {
        'hasErrors': errors.length
      }),
      children: [jsx("input", {
        disabled: disabled,
        readOnly: readonly,
        class: "fjs-input",
        ref: searchbarRef,
        id: domId,
        onChange: onInputChange,
        type: "text",
        value: filter,
        placeholder: 'Search',
        autoComplete: "off",
        onKeyDown: onInputKeyDown,
        onMouseDown: onInputMouseDown,
        onFocus: onInputFocus,
        onBlur: onInputBlur,
        "aria-describedby": props['aria-describedby']
      }), displayState.displayCross && jsxs("span", {
        class: "fjs-select-cross",
        onMouseDown: e => {
          setValue(null);
          e.preventDefault();
        },
        children: [jsx(XMarkIcon, {}), " "]
      }), jsx("span", {
        class: "fjs-select-arrow",
        onMouseDown: e => onAngelMouseDown(e),
        children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
      })]
    }), jsx("div", {
      class: "fjs-select-anchor",
      children: displayState.displayDropdown && jsx(DropdownList, {
        values: filteredOptions,
        getLabel: o => o.label,
        onValueSelected: o => {
          setValue(o);
          setIsDropdownExpanded(false);
        },
        listenerElement: searchbarRef.current
      })
    })]
  });
}

function SimpleSelect(props) {
  const {
    domId,
    disabled,
    errors,
    onBlur,
    onFocus,
    field,
    readonly,
    value
  } = props;
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const selectRef = useRef();
  const inputRef = useRef();
  const {
    loadState,
    options
  } = useOptionsAsync(field);
  useCleanupSingleSelectValue({
    field,
    loadState,
    options,
    value,
    onChange: props.onChange
  });
  const getLabelCorrelation = useGetLabelCorrelation(options);
  const valueLabel = useMemo(() => value && getLabelCorrelation(value), [value, getLabelCorrelation]);
  const setValue = useCallback(option => {
    props.onChange({
      value: option && option.value || null,
      field
    });
  }, [field, props]);
  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded;
    return ds;
  }, [disabled, isDropdownExpanded, loadState, readonly, value]);
  const onMouseDown = useCallback(e => {
    const input = inputRef.current;
    if (disabled || !input) {
      return;
    }
    setIsDropdownExpanded(!isDropdownExpanded);
    if (isDropdownExpanded) {
      input.blur();
    } else {
      input.focus();
    }
    e.preventDefault();
  }, [disabled, isDropdownExpanded]);
  const initialFocusIndex = useMemo(() => value && findIndex(options, o => o.value === value) || 0, [options, value]);
  const onInputFocus = useCallback(() => {
    if (!readonly) {
      setIsDropdownExpanded(true);
      onFocus && onFocus();
    }
  }, [onFocus, readonly]);
  const onInputBlur = useCallback(() => {
    if (!readonly) {
      setIsDropdownExpanded(false);
      onBlur && onBlur();
    }
  }, [onBlur, readonly]);
  return jsxs(Fragment, {
    children: [jsxs("div", {
      ref: selectRef,
      class: classNames('fjs-input-group', {
        disabled,
        readonly
      }, {
        'hasErrors': errors.length
      }),
      onFocus: onInputFocus,
      onBlur: onInputBlur,
      onMouseDown: onMouseDown,
      children: [jsx("div", {
        class: classNames('fjs-select-display', {
          'fjs-select-placeholder': !value
        }),
        id: `${domId}-display`,
        children: valueLabel || 'Výběr'
      }), !disabled && jsx("input", {
        ref: inputRef,
        id: domId,
        class: "fjs-select-hidden-input",
        value: valueLabel,
        onFocus: onInputFocus,
        onBlur: onInputBlur,
        "aria-describedby": props['aria-describedby']
      }), displayState.displayCross && jsx("span", {
        class: "fjs-select-cross",
        onMouseDown: e => {
          setValue(null);
          e.stopPropagation();
        },
        children: jsx(XMarkIcon, {})
      }), jsx("span", {
        class: "fjs-select-arrow",
        children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
      })]
    }), jsx("div", {
      class: "fjs-select-anchor",
      children: displayState.displayDropdown && jsx(DropdownList, {
        values: options,
        getLabel: o => o.label,
        initialFocusIndex: initialFocusIndex,
        onValueSelected: o => {
          setValue(o);
          setIsDropdownExpanded(false);
        },
        listenerElement: selectRef.current
      })
    })]
  });
}

const type$9 = 'select';
function Select(props) {
  const {
    disabled,
    errors = [],
    domId,
    onBlur,
    onFocus,
    field,
    onChange,
    readonly,
    value
  } = props;
  const {
    description,
    label,
    searchable = false,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const descriptionId = `${domId}-description`;
  const errorMessageId = `${domId}-error-message`;
  const selectProps = {
    domId,
    disabled,
    errors,
    onBlur,
    onFocus,
    field,
    value,
    onChange,
    readonly,
    required,
    'aria-invalid': errors.length > 0,
    'aria-describedby': [descriptionId, errorMessageId].join(' ')
  };
  return jsxs("div", {
    class: formFieldClasses(type$9, {
      errors,
      disabled,
      readonly
    }),
    onKeyDown: event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    children: [jsx(Label, {
      htmlFor: domId,
      label: label,
      required: required
    }), searchable ? jsx(SearchableSelect, {
      ...selectProps
    }) : jsx(SimpleSelect, {
      ...selectProps
    }), jsx(Description, {
      id: descriptionId,
      description: description
    }), jsx(Errors, {
      id: errorMessageId,
      errors: errors
    })]
  });
}
Select.config = {
  type: type$9,
  keyed: true,
  label: 'Rozbalovací nabídka',
  group: 'selection',
  emptyValue: null,
  sanitizeValue: sanitizeSingleSelectValue,
  create: createEmptyOptions
};

const type$8 = 'separator';
function Separator() {
  return jsx("div", {
    class: formFieldClasses(type$8),
    children: jsx("hr", {})
  });
}
Separator.config = {
  type: type$8,
  keyed: false,
  label: 'Oddělovač',
  group: 'presentation',
  create: (options = {}) => ({
    ...options
  })
};

const type$7 = 'spacer';
function Spacer(props) {
  const {
    field
  } = props;
  const {
    height = 60
  } = field;
  return jsx("div", {
    class: formFieldClasses(type$7),
    style: {
      height: height
    }
  });
}
Spacer.config = {
  type: type$7,
  keyed: false,
  label: 'Mezera',
  group: 'presentation',
  create: (options = {}) => ({
    height: 60,
    ...options
  })
};

function DynamicList(props) {
  const {
    field,
    domId,
    readonly
  } = props;
  const {
    label,
    type,
    showOutline
  } = field;
  const {
    Empty
  } = useContext(FormRenderContext);
  const fullProps = {
    ...props,
    Empty
  };
  return jsxs("div", {
    className: classNames(formFieldClasses(type, {
      readonly
    }), 'fjs-form-field-grouplike', {
      'fjs-outlined': showOutline
    }),
    role: "group",
    "aria-labelledby": domId,
    children: [jsx(Label, {
      id: domId,
      label: label
    }), jsx(ChildrenRenderer, {
      ...fullProps
    })]
  });
}
DynamicList.config = {
  type: 'dynamiclist',
  pathed: true,
  repeatable: true,
  label: 'Dynamický seznam',
  group: 'container',
  create: (options = {}) => ({
    components: [],
    showOutline: true,
    isRepeating: true,
    allowAddRemove: true,
    defaultRepetitions: 1,
    ...options
  })
};

function SkipLink(props) {
  const {
    className,
    label,
    onSkip
  } = props;
  const onKeyDown = useCallback(event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onSkip();
    }
  }, [onSkip]);
  return jsx("a", {
    href: "#",
    class: classNames('fjs-skip-link', className),
    onKeyDown: onKeyDown,
    children: label
  });
}

const type$6 = 'taglist';
function Taglist(props) {
  const {
    disabled,
    errors = [],
    onFocus,
    domId,
    onBlur,
    field,
    readonly,
    value
  } = props;
  const {
    description,
    label,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const [filter, setFilter] = useState('');
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const [isEscapeClosed, setIsEscapeClose] = useState(false);
  const focusScopeRef = useRef();
  const inputRef = useRef();
  const eventBus = useService('eventBus');
  const {
    loadState,
    options
  } = useOptionsAsync(field);

  // ensures we render based on array content instead of reference
  const values = useDeepCompareMemoize(value || []);
  useCleanupMultiSelectValue({
    field,
    loadState,
    options,
    values,
    onChange: props.onChange
  });
  const getLabelCorrelation = useGetLabelCorrelation(options);
  const hasOptionsLeft = useMemo(() => options.length > values.length, [options.length, values.length]);
  const filteredOptions = useMemo(() => {
    if (loadState !== LOAD_STATES.LOADED) {
      return [];
    }
    const isValidFilteredOption = option => {
      const filterMatches = option.label.toLowerCase().includes(filter.toLowerCase());
      return filterMatches && !hasEqualValue(option.value, values);
    };
    return options.filter(isValidFilteredOption);
  }, [filter, options, values, loadState]);
  const selectValue = value => {
    setFilter('');

    // Ensure values cannot be double selected due to latency
    if (values.at(-1) === value) {
      return;
    }
    props.onChange({
      value: [...values, value],
      field
    });
  };
  const deselectValue = value => {
    const newValues = values.filter(v => !isEqual(v, value));
    props.onChange({
      value: newValues,
      field
    });
  };
  const onInputChange = ({
    target
  }) => {
    setIsEscapeClose(false);
    setFilter(target.value || '');
    eventBus.fire('formField.search', {
      formField: field,
      value: target.value || ''
    });
  };
  const onInputKeyDown = e => {
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        // We do not want the cursor to seek in the search field when we press up and down
        e.preventDefault();
        break;
      case 'Backspace':
        if (!filter && values.length) {
          deselectValue(values[values.length - 1]);
        }
        break;
      case 'Escape':
        setIsEscapeClose(true);
        break;
      case 'Enter':
        if (isEscapeClosed) {
          setIsEscapeClose(false);
        }
        break;
    }
  };
  const onElementBlur = e => {
    if (focusScopeRef.current.contains(e.relatedTarget)) return;
    onBlur && onBlur();
  };
  const onElementFocus = e => {
    if (focusScopeRef.current.contains(e.relatedTarget)) return;
    onFocus && onFocus();
  };
  const onInputBlur = e => {
    if (!readonly) {
      setIsDropdownExpanded(false);
      setFilter('');
    }
    onElementBlur(e);
  };
  const onInputFocus = e => {
    if (!readonly) {
      setIsDropdownExpanded(true);
    }
    onElementFocus(e);
  };
  const onTagRemoveClick = (event, value) => {
    const {
      target
    } = event;
    deselectValue(value);

    // restore focus if there is no next sibling to focus
    const nextTag = target.closest('.fjs-taglist-tag').nextSibling;
    if (!nextTag) {
      inputRef.current.focus();
    }
  };
  const onSkipToSearch = () => {
    inputRef.current.focus();
  };
  const shouldDisplayDropdown = useMemo(() => !disabled && loadState === LOAD_STATES.LOADED && isDropdownExpanded && !isEscapeClosed, [disabled, isDropdownExpanded, isEscapeClosed, loadState]);
  const descriptionId = `${domId}-description`;
  const errorMessageId = `${domId}-error-message`;
  return jsxs("div", {
    ref: focusScopeRef,
    class: formFieldClasses(type$6, {
      errors,
      disabled,
      readonly
    }),
    onKeyDown: event => {
      if (event.key === 'Enter') {
        event.stopPropagation();
        event.preventDefault();
      }
    },
    children: [jsx(Label, {
      label: label,
      required: required,
      htmlFor: domId
    }), !disabled && !readonly && !!values.length && jsx(SkipLink, {
      className: "fjs-taglist-skip-link",
      label: "Skip to search",
      onSkip: onSkipToSearch
    }), jsxs("div", {
      class: classNames('fjs-taglist', {
        'fjs-disabled': disabled,
        'fjs-readonly': readonly
      }),
      children: [loadState === LOAD_STATES.LOADED && jsx("div", {
        class: "fjs-taglist-tags",
        children: values.map(v => {
          return jsxs("div", {
            class: classNames('fjs-taglist-tag', {
              'fjs-disabled': disabled,
              'fjs-readonly': readonly
            }),
            onMouseDown: e => e.preventDefault(),
            children: [jsx("span", {
              class: "fjs-taglist-tag-label",
              children: getLabelCorrelation(v)
            }), !disabled && !readonly && jsx("button", {
              type: "button",
              title: "Remove tag",
              class: "fjs-taglist-tag-remove",
              onFocus: onElementFocus,
              onBlur: onElementBlur,
              onClick: event => onTagRemoveClick(event, v),
              children: jsx(XMarkIcon, {})
            })]
          });
        })
      }), jsx("input", {
        disabled: disabled,
        readOnly: readonly,
        class: "fjs-taglist-input",
        ref: inputRef,
        id: domId,
        onChange: onInputChange,
        type: "text",
        value: filter,
        placeholder: disabled || readonly ? undefined : 'Search',
        autoComplete: "off",
        onKeyDown: onInputKeyDown,
        onMouseDown: () => setIsEscapeClose(false),
        onFocus: onInputFocus,
        onBlur: onInputBlur,
        "aria-describedby": [descriptionId, errorMessageId].join(' '),
        required: required,
        "aria-invalid": errors.length > 0
      })]
    }), jsx("div", {
      class: "fjs-taglist-anchor",
      children: shouldDisplayDropdown && jsx(DropdownList, {
        values: filteredOptions,
        getLabel: o => o.label,
        onValueSelected: o => selectValue(o.value),
        emptyListMessage: hasOptionsLeft ? 'No results' : 'All values selected',
        listenerElement: inputRef.current
      })
    }), jsx(Description, {
      id: descriptionId,
      description: description
    }), jsx(Errors, {
      id: errorMessageId,
      errors: errors
    })]
  });
}
Taglist.config = {
  type: type$6,
  keyed: true,
  label: 'Seznam štítků',
  group: 'selection',
  emptyValue: [],
  sanitizeValue: sanitizeMultiSelectValue,
  create: createEmptyOptions
};

const NODE_TYPE_TEXT = 3,
  NODE_TYPE_ELEMENT = 1;
const ALLOWED_NODES = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'em', 'a', 'p', 'div', 'ul', 'ol', 'li', 'hr', 'blockquote', 'img', 'pre', 'code', 'br', 'strong', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
const ALLOWED_ATTRIBUTES = ['align', 'alt', 'class', 'href', 'id', 'name', 'rel', 'target', 'src'];
const ALLOWED_URI_PATTERN = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i; // eslint-disable-line no-useless-escape
const ATTR_WHITESPACE_PATTERN = /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g; // eslint-disable-line no-control-regex

const FORM_ELEMENT = document.createElement('form');

/**
 * Sanitize a HTML string and return the cleaned, safe version.
 *
 * @param {string} html
 * @return {string}
 */

// see https://github.com/developit/snarkdown/issues/70
function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html>\n<html><body><div>${html}`, 'text/html');
  doc.normalize();
  const element = doc.body.firstChild;
  if (element) {
    sanitizeNode( /** @type Element */element);
    return (/** @type Element */element.innerHTML
    );
  } else {
    // handle the case that document parsing
    // does not work at all, due to HTML gibberish
    return '';
  }
}

/**
 * Recursively sanitize a HTML node, potentially
 * removing it, its children or attributes.
 *
 * Inspired by https://github.com/developit/snarkdown/issues/70
 * and https://github.com/cure53/DOMPurify. Simplified
 * for our use-case.
 *
 * @param {Element} node
 */
function sanitizeNode(node) {
  // allow text nodes
  if (node.nodeType === NODE_TYPE_TEXT) {
    return;
  }

  // disallow all other nodes but Element
  if (node.nodeType !== NODE_TYPE_ELEMENT) {
    return node.remove();
  }
  const lcTag = node.tagName.toLowerCase();

  // disallow non-whitelisted tags
  if (!ALLOWED_NODES.includes(lcTag)) {
    return node.remove();
  }
  const attributes = node.attributes;

  // clean attributes
  for (let i = attributes.length; i--;) {
    const attribute = attributes[i];
    const name = attribute.name;
    const lcName = name.toLowerCase();

    // normalize node value
    const value = attribute.value.trim();
    node.removeAttribute(name);
    const valid = isValidAttribute(lcTag, lcName, value);
    if (valid) {
      node.setAttribute(name, value);
    }
  }

  // force noopener on target="_blank" links
  if (lcTag === 'a' && node.getAttribute('target') === '_blank' && node.getAttribute('rel') !== 'noopener') {
    node.setAttribute('rel', 'noopener');
  }
  for (let i = node.childNodes.length; i--;) {
    sanitizeNode( /** @type Element */node.childNodes[i]);
  }
}

/**
 * Validates attributes for validity.
 *
 * @param {string} lcTag
 * @param {string} lcName
 * @param {string} value
 * @return {boolean}
 */
function isValidAttribute(lcTag, lcName, value) {
  // disallow most attributes based on whitelist
  if (!ALLOWED_ATTRIBUTES.includes(lcName)) {
    return false;
  }

  // disallow "DOM clobbering" / polution of document and wrapping form elements
  if ((lcName === 'id' || lcName === 'name') && (value in document || value in FORM_ELEMENT)) {
    return false;
  }
  if (lcName === 'target' && value !== '_blank') {
    return false;
  }

  // allow valid url links only
  if (lcName === 'href' && !ALLOWED_URI_PATTERN.test(value.replace(ATTR_WHITESPACE_PATTERN, ''))) {
    return false;
  }
  return true;
}

const type$5 = 'text';
function Text(props) {
  const form = useService('form');
  const {
    textLinkTarget
  } = form._getState().properties;
  const {
    field,
    disableLinks
  } = props;
  const {
    text = '',
    strict = false
  } = field;
  const markdownRenderer = useService('markdownRenderer');

  // feelers => pure markdown
  const markdown = useTemplateEvaluation(text, {
    debug: true,
    strict
  });

  // markdown => html
  const html = useMemo(() => markdownRenderer.render(markdown), [markdownRenderer, markdown]);
  const sanitizeAndTransformLinks = useCallback(unsafeHtml => {
    const html = sanitizeHTML(unsafeHtml);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const links = tempDiv.querySelectorAll('a');
    links.forEach(link => {
      if (disableLinks) {
        link.setAttribute('class', 'fjs-disabled-link');
        link.setAttribute('tabIndex', '-1');
      }
      if (textLinkTarget) {
        link.setAttribute('target', textLinkTarget);
      }
    });
    return tempDiv.innerHTML;
  }, [disableLinks, textLinkTarget]);
  const dangerouslySetInnerHTML = useDangerousHTMLWrapper({
    html,
    transform: sanitizeAndTransformLinks,
    sanitize: false,
    sanitizeStyleTags: false
  });
  return jsx("div", {
    class: formFieldClasses(type$5),
    dangerouslySetInnerHTML: dangerouslySetInnerHTML
  });
}
Text.config = {
  type: type$5,
  keyed: false,
  label: 'Textový popis',
  group: 'presentation',
  create: (options = {}) => ({
    text: '# Text',
    ...options
  })
};

const type$4 = 'html';
function Html(props) {
  const form = useService('form');
  const {
    textLinkTarget
  } = form._getState().properties;
  const {
    field,
    disableLinks,
    domId
  } = props;
  const {
    content = '',
    strict = false
  } = field;
  const styleScope = `${domId}-style-scope`;

  // we escape HTML within the template evaluation to prevent clickjacking attacks
  const html = useTemplateEvaluation(content, {
    debug: true,
    strict,
    sanitizer: escapeHTML
  });
  const transform = useCallback(html => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // (1) apply modifications to links

    const links = tempDiv.querySelectorAll('a');
    links.forEach(link => {
      if (disableLinks) {
        link.setAttribute('class', 'fjs-disabled-link');
        link.setAttribute('tabIndex', '-1');
      }
      if (textLinkTarget) {
        link.setAttribute('target', textLinkTarget);
      }
    });

    // (2) scope styles to the root div
    wrapCSSStyles(tempDiv, `.${styleScope}`);
    return tempDiv.innerHTML;
  }, [disableLinks, styleScope, textLinkTarget]);
  const dangerouslySetInnerHTML = useDangerousHTMLWrapper({
    html,
    transform,
    sanitize: true,
    sanitizeStyleTags: false
  });
  return jsx("div", {
    class: classNames(formFieldClasses(type$4), styleScope),
    dangerouslySetInnerHTML: dangerouslySetInnerHTML
  });
}
Html.config = {
  type: type$4,
  keyed: false,
  label: 'HTML',
  group: 'presentation',
  create: (options = {}) => ({
    content: '',
    ...options
  })
};

const type$3 = 'expression';
function ExpressionField(props) {
  const {
    field,
    onChange,
    value
  } = props;
  const {
    computeOn,
    expression
  } = field;
  const evaluation = useExpressionEvaluation(expression);
  const evaluationMemo = useDeepCompareMemoize(evaluation);
  const eventBus = useService('eventBus');
  const sendValue = useCallback(() => {
    onChange && onChange({
      field,
      value: evaluationMemo
    });
  }, [field, evaluationMemo, onChange]);
  useEffect(() => {
    if (computeOn !== 'change' || evaluationMemo === value) {
      return;
    }
    sendValue();
  }, [computeOn, evaluationMemo, sendValue, value]);
  useEffect(() => {
    if (computeOn === 'presubmit') {
      eventBus.on('presubmit', sendValue);
      return () => eventBus.off('presubmit', sendValue);
    }
  }, [computeOn, sendValue, eventBus]);
  return null;
}
ExpressionField.config = {
  type: type$3,
  label: 'Výraz',
  group: 'basic-input',
  keyed: true,
  emptyValue: null,
  escapeGridRender: true,
  create: (options = {}) => ({
    computeOn: 'change',
    ...options
  })
};

const type$2 = 'textfield';
function Textfield(props) {
  const {
    disabled,
    errors = [],
    domId,
    onBlur,
    onFocus,
    field,
    readonly,
    value = ''
  } = props;
  const {
    description,
    label,
    appearance = {},
    validate = {}
  } = field;
  const {
    prefixAdorner,
    suffixAdorner
  } = appearance;
  const {
    required
  } = validate;
  const [onInputChange, flushOnChange] = useFlushDebounce(({
    target
  }) => {
    props.onChange({
      field,
      value: target.value
    });
  });
  const onInputBlur = () => {
    flushOnChange && flushOnChange();
    onBlur && onBlur();
  };
  const onInputFocus = () => {
    onFocus && onFocus();
  };
  const descriptionId = `${domId}-description`;
  const errorMessageId = `${domId}-error-message`;
  return jsxs("div", {
    class: formFieldClasses(type$2, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      htmlFor: domId,
      label: label,
      required: required
    }), jsx(TemplatedInputAdorner, {
      disabled: disabled,
      readonly: readonly,
      pre: prefixAdorner,
      post: suffixAdorner,
      children: jsx("input", {
        class: "fjs-input",
        disabled: disabled,
        readOnly: readonly,
        id: domId,
        onInput: onInputChange,
        onBlur: onInputBlur,
        onFocus: onInputFocus,
        type: "text",
        value: value,
        "aria-describedby": [descriptionId, errorMessageId].join(' '),
        required: required,
        "aria-invalid": errors.length > 0
      })
    }), jsx(Description, {
      id: descriptionId,
      description: description
    }), jsx(Errors, {
      id: errorMessageId,
      errors: errors
    })]
  });
}
Textfield.config = {
  type: type$2,
  keyed: true,
  label: 'Text',
  group: 'basic-input',
  emptyValue: '',
  sanitizeValue: ({
    value
  }) => {
    if (isArray(value) || isObject(value) || isNil(value)) {
      return '';
    }

    // sanitize newlines to spaces
    if (typeof value === 'string') {
      return value.replace(/[\r\n\t]/g, ' ');
    }
    return String(value);
  },
  create: (options = {}) => ({
    ...options
  })
};

const type$1 = 'textarea';
function Textarea(props) {
  const {
    disabled,
    errors = [],
    domId,
    onBlur,
    onFocus,
    field,
    readonly,
    value = ''
  } = props;
  const {
    description,
    label,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const textareaRef = useRef();
  const [onChange, flushOnChange] = useFlushDebounce(({
    target
  }) => {
    props.onChange({
      field,
      value: target.value
    });
  });
  const onInputBlur = () => {
    flushOnChange && flushOnChange();
    onBlur && onBlur();
  };
  const onInputFocus = () => {
    onFocus && onFocus();
  };
  const onInputChange = event => {
    onChange({
      target: event.target
    });
    autoSizeTextarea(textareaRef.current);
  };
  useLayoutEffect(() => {
    autoSizeTextarea(textareaRef.current);
  }, [value]);
  useEffect(() => {
    autoSizeTextarea(textareaRef.current);
  }, []);
  const descriptionId = `${domId}-description`;
  const errorMessageId = `${domId}-error-message`;
  return jsxs("div", {
    class: formFieldClasses(type$1, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      htmlFor: domId,
      label: label,
      required: required
    }), jsx("textarea", {
      class: "fjs-textarea",
      disabled: disabled,
      readonly: readonly,
      id: domId,
      onInput: onInputChange,
      onBlur: onInputBlur,
      onFocus: onInputFocus,
      value: value,
      ref: textareaRef,
      "aria-describedby": [descriptionId, errorMessageId].join(' '),
      required: required,
      "aria-invalid": errors.length > 0
    }), jsx(Description, {
      id: descriptionId,
      description: description
    }), jsx(Errors, {
      id: errorMessageId,
      errors: errors
    })]
  });
}
Textarea.config = {
  type: type$1,
  keyed: true,
  label: 'Dlouhý text',
  group: 'basic-input',
  emptyValue: '',
  sanitizeValue: ({
    value
  }) => isArray(value) || isObject(value) || isNil(value) ? '' : String(value),
  create: (options = {}) => ({
    ...options
  })
};
const autoSizeTextarea = textarea => {
  // Ensures the textarea shrinks back, and improves resizing behavior consistency
  textarea.style.height = '0px';
  const computed = window.getComputedStyle(textarea);
  const heightFromLines = () => {
    const lineHeight = parseInt(computed.getPropertyValue('line-height').replace('px', '')) || 0;
    const lines = textarea.value ? textarea.value.toString().split('\n').length : 0;
    return lines * lineHeight;
  };
  const calculatedHeight = parseInt(computed.getPropertyValue('border-top-width')) + parseInt(computed.getPropertyValue('padding-top')) + (textarea.scrollHeight || heightFromLines()) + parseInt(computed.getPropertyValue('padding-bottom')) + parseInt(computed.getPropertyValue('border-bottom-width'));
  const minHeight = 75;
  const maxHeight = 350;
  const displayHeight = Math.max(Math.min(calculatedHeight || 0, maxHeight), minHeight);
  textarea.style.height = `${displayHeight}px`;

  // Overflow is hidden by default to hide scrollbar flickering
  textarea.style.overflow = calculatedHeight > maxHeight ? 'visible' : 'hidden';
};

var _path$7;
function _extends$7() { _extends$7 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$7.apply(this, arguments); }
var SvgArrowDown = function SvgArrowDown(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$7({
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32"
  }, props), _path$7 || (_path$7 = /*#__PURE__*/React.createElement("path", {
    fill: "currentcolor",
    d: "M24.59 16.59 17 24.17V4h-2v20.17l-7.59-7.58L6 18l10 10 10-10-1.41-1.41z"
  })));
};
var ArrowDownIcon = SvgArrowDown;

var _path$6;
function _extends$6() { _extends$6 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$6.apply(this, arguments); }
var SvgArrowUp = function SvgArrowUp(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$6({
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32"
  }, props), _path$6 || (_path$6 = /*#__PURE__*/React.createElement("path", {
    fill: "currentcolor",
    d: "M16 4 6 14l1.41 1.41L15 7.83V28h2V7.83l7.59 7.58L26 14 16 4z"
  })));
};
var ArrowUpIcon = SvgArrowUp;

var _path$5;
function _extends$5() { _extends$5 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$5.apply(this, arguments); }
var SvgCaretLeft = function SvgCaretLeft(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$5({
    xmlns: "http://www.w3.org/2000/svg",
    xmlSpace: "preserve",
    viewBox: "0 0 32 32"
  }, props), _path$5 || (_path$5 = /*#__PURE__*/React.createElement("path", {
    fill: "currentcolor",
    d: "m20 24-10-8 10-8z"
  })));
};
var CaretLeftIcon = SvgCaretLeft;

var _path$4;
function _extends$4() { _extends$4 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$4.apply(this, arguments); }
var SvgCaretRight = function SvgCaretRight(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$4({
    xmlns: "http://www.w3.org/2000/svg",
    xmlSpace: "preserve",
    viewBox: "0 0 32 32"
  }, props), _path$4 || (_path$4 = /*#__PURE__*/React.createElement("path", {
    fill: "currentcolor",
    d: "m12 8 10 8-10 8z"
  })));
};
var CaretRightIcon = SvgCaretRight;

const type = 'table';

/**
 * @typedef {('asc'|'desc')} Direction
 *
 * @typedef Sorting
 * @property {string} key
 * @property {Direction} direction
 *
 * @typedef Column
 * @property {string} label
 * @property {string} key
 *
 * @typedef Field
 * @property {string} id
 * @property {Array<Column>} [columns]
 * @property {string} [columnsExpression]
 * @property {string} [label]
 * @property {number} [rowCount]
 * @property {string} [dataSource]
 *
 * @typedef Props
 * @property {Field} field
 *
 * @param {Props} props
 * @returns {import("preact").JSX.Element}
 */
function Table(props) {
  const {
    field
  } = props;
  const {
    columns = [],
    columnsExpression,
    dataSource = '',
    rowCount,
    id,
    label
  } = field;

  /** @type {[(null|Sorting), import("preact/hooks").StateUpdater<null|Sorting>]} */
  const [sortBy, setSortBy] = useState(null);
  const evaluatedColumns = useEvaluatedColumns(columnsExpression || '', columns);
  const columnKeys = evaluatedColumns.map(({
    key
  }) => key);
  const evaluatedDataSource = useExpressionEvaluation(dataSource);
  const data = Array.isArray(evaluatedDataSource) ? evaluatedDataSource.filter(i => i !== undefined) : [];
  const sortedData = sortBy === null ? data : sortByColumn(data, sortBy.key, sortBy.direction);

  /** @type {unknown[][]} */
  const chunkedData = isNumber(rowCount) ? chunk(sortedData, rowCount) : [sortedData];
  const [currentPage, setCurrentPage] = useState(0);
  const currentChunk = chunkedData[currentPage] || [];
  useEffect(() => {
    setCurrentPage(0);
  }, [rowCount, sortBy]);

  /** @param {string} key */
  function toggleSortBy(key) {
    setSortBy(current => {
      if (current === null || current.key !== key) {
        return {
          key,
          direction: 'asc'
        };
      }
      if (current.direction === 'desc') {
        return null;
      }
      return {
        key,
        direction: 'desc'
      };
    });
  }
  return jsxs("div", {
    class: formFieldClasses(type),
    children: [jsx(Label, {
      htmlFor: prefixId(id),
      label: label
    }), jsxs("div", {
      class: classNames('fjs-table-middle-container', {
        'fjs-table-empty': evaluatedColumns.length === 0
      }),
      children: [evaluatedColumns.length === 0 ? 'Nothing to show.' : jsx("div", {
        class: "fjs-table-inner-container",
        children: jsxs("table", {
          class: "fjs-table",
          id: prefixId(id),
          children: [jsx("thead", {
            class: "fjs-table-head",
            children: jsx("tr", {
              class: "fjs-table-tr",
              children: evaluatedColumns.map(({
                key,
                label
              }) => {
                const displayLabel = label || key;
                return jsx("th", {
                  tabIndex: 0,
                  class: "fjs-table-th",
                  onClick: () => {
                    toggleSortBy(key);
                  },
                  onKeyDown: event => {
                    if (['Enter', 'Space'].includes(event.code)) {
                      toggleSortBy(key);
                    }
                  },
                  "aria-label": getHeaderAriaLabel(sortBy, key, displayLabel),
                  children: jsxs("span", {
                    class: "fjs-table-th-label",
                    children: [displayLabel, sortBy !== null && sortBy.key === key ? jsx(Fragment, {
                      children: sortBy.direction === 'asc' ? jsx(ArrowUpIcon, {
                        class: "fjs-table-sort-icon-asc"
                      }) : jsx(ArrowDownIcon, {
                        class: "fjs-table-sort-icon-desc"
                      })
                    }) : null]
                  })
                }, key);
              })
            })
          }), currentChunk.length === 0 ? jsx("tbody", {
            class: "fjs-table-body",
            children: jsx("tr", {
              class: "fjs-table-tr",
              children: jsx("td", {
                class: "fjs-table-td",
                colSpan: evaluatedColumns.length,
                children: "Nothing to show."
              })
            })
          }) : jsx("tbody", {
            class: "fjs-table-body",
            children: currentChunk.map((row, index) => jsx("tr", {
              class: "fjs-table-tr",
              children: columnKeys.map(key => jsx("td", {
                class: "fjs-table-td",
                children: row[key]
              }, key))
            }, index))
          })]
        })
      }), isNumber(rowCount) && chunkedData.length > 1 && evaluatedColumns.length > 0 ? jsxs("nav", {
        class: "fjs-table-nav",
        children: [jsxs("span", {
          class: "fjs-table-nav-label",
          children: [currentPage + 1, " of ", chunkedData.length]
        }), jsx("button", {
          type: "button",
          class: "fjs-table-nav-button",
          onClick: () => {
            setCurrentPage(page => Math.max(page - 1, 0));
          },
          disabled: currentPage === 0,
          "aria-label": "Previous page",
          children: jsx(CaretLeftIcon, {})
        }), jsx("button", {
          type: "button",
          class: "fjs-table-nav-button",
          onClick: () => {
            setCurrentPage(page => Math.min(page + 1, chunkedData.length - 1));
          },
          disabled: currentPage >= chunkedData.length - 1,
          "aria-label": "Next page",
          children: jsx(CaretRightIcon, {})
        })]
      }) : null]
    })]
  });
}
Table.config = {
  type,
  keyed: false,
  label: 'Tabulka',
  group: 'presentation',
  create: (options = {}) => {
    const {
      id,
      columnsExpression,
      columns,
      rowCount,
      ...remainingOptions
    } = options;
    if (isDefined(id) && isNumber(rowCount)) {
      remainingOptions['rowCount'] = rowCount;
    }
    if (isString(columnsExpression)) {
      return {
        ...remainingOptions,
        id,
        columnsExpression
      };
    }
    if (Array.isArray(columns) && columns.every(isColumn)) {
      return {
        ...remainingOptions,
        id,
        columns
      };
    }
    return {
      ...remainingOptions,
      rowCount: 10,
      columns: [{
        label: 'ID',
        key: 'id'
      }, {
        label: 'Name',
        key: 'name'
      }, {
        label: 'Date',
        key: 'date'
      }]
    };
  },
  /**
   * @experimental
   *
   * A function that generates demo data for a new field on the form playground.
   * @param {Field} field
   */
  generateInitialDemoData: field => {
    const demoData = [{
      id: 1,
      name: 'John Doe',
      date: '31.01.2023'
    }, {
      id: 2,
      name: 'Erika Muller',
      date: '20.02.2023'
    }, {
      id: 3,
      name: 'Dominic Leaf',
      date: '11.03.2023'
    }];
    const demoDataKeys = Object.keys(demoData[0]);
    const {
      columns,
      id,
      dataSource
    } = field;
    if (!Array.isArray(columns) || columns.length === 0 || dataSource !== `=${id}`) {
      return;
    }
    if (!columns.map(({
      key
    }) => key).every(key => demoDataKeys.includes(key))) {
      return;
    }
    return demoData;
  }
};

// helpers /////////////////////////////

/**
 * @param {string|void} columnsExpression
 * @param {Column[]} fallbackColumns
 * @returns {Column[]}
 */
function useEvaluatedColumns(columnsExpression, fallbackColumns) {
  /** @type {Column[]|null} */
  const evaluation = useExpressionEvaluation(columnsExpression || '');
  return Array.isArray(evaluation) && evaluation.every(isColumn) ? evaluation : fallbackColumns;
}

/**
 * @param {any} column
 * @returns {column is Column}
 */
function isColumn(column) {
  return isObject(column) && isString(column['label']) && isString(column['key']);
}

/**
 * @param {Array} array
 * @param {number} size
 * @returns {Array}
 */
function chunk(array, size) {
  return array.reduce((chunks, item, index) => {
    if (index % size === 0) {
      chunks.push([item]);
    } else {
      chunks[chunks.length - 1].push(item);
    }
    return chunks;
  }, []);
}

/**
 * @param {unknown[]} array
 * @param {string} key
 * @param {Direction} direction
 * @returns {unknown[]}
 */
function sortByColumn(array, key, direction) {
  return [...array].sort((a, b) => {
    if (!isObject(a) || !isObject(b)) {
      return 0;
    }
    if (direction === 'asc') {
      return a[key] > b[key] ? 1 : -1;
    }
    return a[key] < b[key] ? 1 : -1;
  });
}

/**
 * @param {null|Sorting} sortBy
 * @param {string} key
 * @param {string} label
 */
function getHeaderAriaLabel(sortBy, key, label) {
  if (sortBy === null || sortBy.key !== key) {
    return `Click to sort by ${label} descending`;
  }
  if (sortBy.direction === 'asc') {
    return 'Click to remove sorting';
  }
  return `Click to sort by ${label} ascending`;
}

/**
 * This file must not be changed or exchanged.
 *
 * @see http://bpmn.io/license for more information.
 */
function Logo() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 14.02 5.57",
    width: "53",
    height: "21",
    style: "vertical-align:middle",
    children: [jsx("path", {
      fill: "currentColor",
      d: "M1.88.92v.14c0 .41-.13.68-.4.8.33.14.46.44.46.86v.33c0 .61-.33.95-.95.95H0V0h.95c.65 0 .93.3.93.92zM.63.57v1.06h.24c.24 0 .38-.1.38-.43V.98c0-.28-.1-.4-.32-.4zm0 1.63v1.22h.36c.2 0 .32-.1.32-.39v-.35c0-.37-.12-.48-.4-.48H.63zM4.18.99v.52c0 .64-.31.98-.94.98h-.3V4h-.62V0h.92c.63 0 .94.35.94.99zM2.94.57v1.35h.3c.2 0 .3-.09.3-.37v-.6c0-.29-.1-.38-.3-.38h-.3zm2.89 2.27L6.25 0h.88v4h-.6V1.12L6.1 3.99h-.6l-.46-2.82v2.82h-.55V0h.87zM8.14 1.1V4h-.56V0h.79L9 2.4V0h.56v4h-.64zm2.49 2.29v.6h-.6v-.6zM12.12 1c0-.63.33-1 .95-1 .61 0 .95.37.95 1v2.04c0 .64-.34 1-.95 1-.62 0-.95-.37-.95-1zm.62 2.08c0 .28.13.39.33.39s.32-.1.32-.4V.98c0-.29-.12-.4-.32-.4s-.33.11-.33.4z"
    }), jsx("path", {
      fill: "currentColor",
      d: "M0 4.53h14.02v1.04H0zM11.08 0h.63v.62h-.63zm.63 4V1h-.63v2.98z"
    })]
  });
}
function Lightbox(props) {
  const {
    open
  } = props;
  if (!open) {
    return null;
  }
  return jsxs("div", {
    class: "fjs-powered-by-lightbox",
    style: "z-index: 100; position: fixed; top: 0; left: 0;right: 0; bottom: 0",
    children: [jsx("div", {
      class: "backdrop",
      style: "width: 100%; height: 100%; background: rgba(40 40 40 / 20%)",
      onClick: props.onBackdropClick
    }), jsxs("div", {
      class: "notice",
      style: "position: absolute; left: 50%; top: 40%; transform: translate(-50%); width: 260px; padding: 10px; background: white; box-shadow: 0  1px 4px rgba(0 0 0 / 30%); font-family: Helvetica, Arial, sans-serif; font-size: 14px; display: flex; line-height: 1.3",
      children: [jsx("a", {
        href: "https://bpmn.io",
        target: "_blank",
        rel: "noopener",
        style: "margin: 15px 20px 15px 10px; align-self: center; color: var(--cds-icon-primary, #404040)",
        children: jsx(Logo, {})
      }), jsxs("span", {
        children: ["Web-based tooling for BPMN, DMN, and forms powered by ", jsx("a", {
          href: "https://bpmn.io",
          target: "_blank",
          rel: "noopener",
          children: "bpmn.io"
        }), "."]
      })]
    })]
  });
}
function Link(props) {
  return jsx("div", {
    class: "fjs-powered-by fjs-form-field",
    style: "text-align: right",
    children: jsx("a", {
      href: "https://bpmn.io",
      target: "_blank",
      rel: "noopener",
      class: "fjs-powered-by-link",
      title: "Powered by bpmn.io",
      style: "color: var(--cds-text-primary, #404040)",
      onClick: props.onClick,
      children: jsx(Logo, {})
    })
  });
}
function PoweredBy(props) {
  const [open, setOpen] = useState(false);
  function toggleOpen(open) {
    return event => {
      event.preventDefault();
      setOpen(open);
    };
  }
  return jsxs(Fragment$1, {
    children: [createPortal(jsx(Lightbox, {
      open: open,
      onBackdropClick: toggleOpen(false)
    }), document.body), jsx(Link, {
      onClick: toggleOpen(true)
    })]
  });
}

const noop = () => {};
function FormComponent(props) {
  const form = useService('form');
  const {
    schema,
    properties
  } = form._getState();
  const {
    ariaLabel
  } = properties;
  const {
    onSubmit = noop,
    onReset = noop,
    onChange = noop
  } = props;
  const handleSubmit = event => {
    event.preventDefault();
    onSubmit();
  };
  const handleReset = event => {
    event.preventDefault();
    onReset();
  };
  const filteredFormData = useFilteredFormData();
  const localExpressionContext = useMemo(() => ({
    data: filteredFormData,
    parent: null,
    this: filteredFormData,
    i: []
  }), [filteredFormData]);
  return jsxs("form", {
    class: "fjs-form",
    onSubmit: handleSubmit,
    onReset: handleReset,
    "aria-label": ariaLabel,
    noValidate: true,
    children: [jsx(LocalExpressionContext.Provider, {
      value: localExpressionContext,
      children: jsx(FormField, {
        field: schema,
        onChange: onChange
      })
    }), jsx(PoweredBy, {})]
  });
}

const formFields = [/* Input */
Textfield, Textarea, Numberfield, Datetime, ExpressionField, /* Selection */
Checkbox, Checklist, Radio, Select, Taglist, /* Presentation */
Text, Image, Table, Html, Spacer, Separator, /* Containers */
Group, DynamicList, IFrame, /* Other */
Button, Default];

class FormFields {
  constructor() {
    this._formFields = {};
    formFields.forEach(formField => {
      this.register(formField.config.type, formField);
    });
  }
  register(type, formField) {
    this._formFields[type] = formField;
  }
  get(type) {
    return this._formFields[type];
  }
}

const EXPRESSION_PROPERTIES = ['alt', 'appearance.prefixAdorner', 'appearance.suffixAdorner', 'conditional.hide', 'description', 'label', 'source', 'readonly', 'text', 'validate.min', 'validate.max', 'validate.minLength', 'validate.maxLength', 'valuesExpression', 'url', 'dataSource', 'columnsExpression'];
const TEMPLATE_PROPERTIES = ['alt', 'appearance.prefixAdorner', 'appearance.suffixAdorner', 'description', 'label', 'source', 'text', 'content', 'url'];

/**
 * @typedef { import('../types').Schema } Schema
 */

/**
 * Parse the schema for variables a form might make use of.
 *
 * @example
 *
 * // retrieve variables from schema
 * const variables = getSchemaVariables(schema);
 *
 * @example
 *
 * // retrieve input variables from schema
 * const inputVariables = getSchemaVariables(schema, { outputs: false });
 *
 * @example
 *
 * // retrieve output variables from schema
 * const outputVariables = getSchemaVariables(schema, { inputs: false });
 *
 * @param {Schema} schema
 * @param {object} [options]
 * @param {any} [options.expressionLanguage]
 * @param {any} [options.templating]
 * @param {any} [options.formFields]
 * @param {boolean} [options.inputs=true]
 * @param {boolean} [options.outputs=true]
 *
 * @return {string[]}
 */
function getSchemaVariables(schema, options = {}) {
  const {
    formFields = new FormFields(),
    expressionLanguage = new FeelExpressionLanguage(null),
    templating = new FeelersTemplating(),
    inputs = true,
    outputs = true
  } = options;
  if (!schema.components) {
    return [];
  }
  const getAllComponents = node => {
    const components = [];
    if (node.components) {
      node.components.forEach(component => {
        components.push(component);
        components.push(...getAllComponents(component));
      });
    }
    return components;
  };
  const variables = getAllComponents(schema).reduce((variables, component) => {
    const {
      valuesKey
    } = component;

    // collect input-only variables
    if (inputs) {
      if (valuesKey) {
        variables = [...variables, valuesKey];
      }
      EXPRESSION_PROPERTIES.forEach(prop => {
        const property = get(component, prop.split('.'));
        if (property && expressionLanguage.isExpression(property)) {
          const expressionVariables = expressionLanguage.getVariableNames(property, {
            type: 'expression'
          });
          variables = [...variables, ...expressionVariables];
        }
      });
      TEMPLATE_PROPERTIES.forEach(prop => {
        const property = get(component, prop.split('.'));
        if (property && !expressionLanguage.isExpression(property) && templating.isTemplate(property)) {
          const templateVariables = templating.getVariableNames(property);
          variables = [...variables, ...templateVariables];
        }
      });
    }
    return variables.filter(variable => typeof variable === 'string');
  }, []);
  const getBindingVariables = node => {
    const bindingVariable = [];
    const formField = formFields.get(node.type);
    if (formField && formField.config.keyed && node.key) {
      return [node.key.split('.')[0]];
    } else if (formField && formField.config.pathed && node.path) {
      return [node.path.split('.')[0]];
    } else if (node.components) {
      node.components.forEach(component => {
        bindingVariable.push(...getBindingVariables(component));
      });
    }
    return bindingVariable;
  };

  // collect binding variables
  if (inputs || outputs) {
    variables.push(...getBindingVariables(schema));
  }

  // remove duplicates
  return Array.from(new Set(variables));
}

/**
 * Get the ancestry list of a form field.
 *
 * @param {string} formFieldId
 * @param {import('../core/FormFieldRegistry').FormFieldRegistry} formFieldRegistry
 *
 * @return {Array<string>} ancestry list
 */
const getAncestryList = (formFieldId, formFieldRegistry) => {
  const ids = [];
  let currentFormField = formFieldRegistry.get(formFieldId);
  while (currentFormField) {
    ids.push(currentFormField.id);
    currentFormField = formFieldRegistry.get(currentFormField._parent);
  }
  return ids;
};

/**
 * @typedef {object} Condition
 * @property {string} [hide]
 */

class ConditionChecker {
  constructor(formFieldRegistry, pathRegistry, eventBus) {
    this._formFieldRegistry = formFieldRegistry;
    this._pathRegistry = pathRegistry;
    this._eventBus = eventBus;
  }

  /**
   * For given data, remove properties based on condition.
   *
   * @param {Object<string, any>} data
   * @param {Object<string, any>} contextData
   * @param {Object} [options]
   * @param {Function} [options.getFilterPath]
   * @param {boolean} [options.leafNodeDeletionOnly]
   */
  applyConditions(data, contextData = {}, options = {}) {
    const workingData = clone(data);
    const {
      getFilterPath = (field, indexes) => this._pathRegistry.getValuePath(field, {
        indexes
      }),
      leafNodeDeletionOnly = false
    } = options;
    const _applyConditionsWithinScope = (rootField, scopeContext, startHidden = false) => {
      const {
        indexes = {},
        expressionIndexes = [],
        scopeData = contextData,
        parentScopeData = null
      } = scopeContext;
      this._pathRegistry.executeRecursivelyOnFields(rootField, ({
        field,
        isClosed,
        isRepeatable,
        context
      }) => {
        const {
          conditional,
          components,
          id
        } = field;

        // build the expression context in the right format
        const localExpressionContext = buildExpressionContext({
          this: scopeData,
          data: contextData,
          i: expressionIndexes,
          parent: parentScopeData
        });
        context.isHidden = startHidden || context.isHidden || conditional && this._checkHideCondition(conditional, localExpressionContext);

        // if a field is repeatable and visible, we need to implement custom recursion on its children
        if (isRepeatable && (!context.isHidden || leafNodeDeletionOnly)) {
          // prevent the regular recursion behavior of executeRecursivelyOnFields
          context.preventRecursion = true;
          const repeaterValuePath = this._pathRegistry.getValuePath(field, {
            indexes
          });
          const repeaterValue = get(contextData, repeaterValuePath);

          // quit early if there are no children or data associated with the repeater
          if (!Array.isArray(repeaterValue) || !repeaterValue.length || !Array.isArray(components) || !components.length) {
            return;
          }
          for (let i = 0; i < repeaterValue.length; i++) {
            // create a new scope context for each index
            const newScopeContext = {
              indexes: {
                ...indexes,
                [id]: i
              },
              expressionIndexes: [...expressionIndexes, i + 1],
              scopeData: repeaterValue[i],
              parentScopeData: scopeData
            };

            // for each child component, apply conditions within the new repetition scope
            components.forEach(component => {
              _applyConditionsWithinScope(component, newScopeContext, context.isHidden);
            });
          }
        }

        // if we have a hidden repeatable field, and the data structure allows, we clear it directly at the root and stop recursion
        if (context.isHidden && !leafNodeDeletionOnly && isRepeatable) {
          context.preventRecursion = true;
          this._cleanlyClearDataAtPath(getFilterPath(field, indexes), workingData);
        }

        // for simple leaf fields, we always clear
        if (context.isHidden && isClosed) {
          this._cleanlyClearDataAtPath(getFilterPath(field, indexes), workingData);
        }
      });
    };

    // apply conditions starting with the root of the form
    const form = this._formFieldRegistry.getForm();
    if (!form) {
      throw new Error('form field registry has no form');
    }
    _applyConditionsWithinScope(form, {
      scopeData: contextData
    });
    return workingData;
  }

  /**
   * Check if given condition is met. Returns null for invalid/missing conditions.
   *
   * @param {string} condition
   * @param {import('../../types').Data} [data]
   *
   * @returns {boolean|null}
   */
  check(condition, data = {}) {
    if (!condition) {
      return null;
    }
    if (!isString(condition) || !condition.startsWith('=')) {
      return null;
    }
    try {
      // cut off initial '='
      const result = unaryTest(condition.slice(1), data);
      return result;
    } catch (error) {
      this._eventBus.fire('error', {
        error
      });
      return null;
    }
  }

  /**
   * Check if hide condition is met.
   *
   * @param {Condition} condition
   * @param {Object<string, any>} data
   * @returns {boolean}
   */
  _checkHideCondition(condition, data) {
    if (!condition.hide) {
      return false;
    }
    const result = this.check(condition.hide, data);
    return result === true;
  }
  _cleanlyClearDataAtPath(valuePath, obj) {
    const workingValuePath = [...valuePath];
    let recurse = false;
    do {
      set(obj, workingValuePath, undefined);
      workingValuePath.pop();
      const parentObject = get(obj, workingValuePath);
      recurse = !!workingValuePath.length && (this._isEmptyObject(parentObject) || this._isEmptyArray(parentObject));
    } while (recurse);
  }
  _isEmptyObject(parentObject) {
    return isObject(parentObject) && !values(parentObject).length;
  }
  _isEmptyArray(parentObject) {
    return Array.isArray(parentObject) && (!parentObject.length || parentObject.every(item => item === undefined));
  }
}
ConditionChecker.$inject = ['formFieldRegistry', 'pathRegistry', 'eventBus'];

const ExpressionLanguageModule = {
  __init__: ['expressionLanguage', 'templating', 'conditionChecker'],
  expressionLanguage: ['type', FeelExpressionLanguage],
  templating: ['type', FeelersTemplating],
  conditionChecker: ['type', ConditionChecker]
};

class MarkdownRenderer {
  /**
   * Render markdown to HTML.
   *
   * @param {string} markdown - The markdown to render
   *
   * @returns {string} HTML
   */
  render(markdown) {
    // @ts-expect-error
    return marked.parse(markdown, {
      gfm: true,
      breaks: true
    });
  }
}
MarkdownRenderer.$inject = [];

const MarkdownRendererModule = {
  __init__: ['markdownRenderer'],
  markdownRenderer: ['type', MarkdownRenderer]
};

/**
 * @typedef {import('didi').Injector} Injector
 *
 * @typedef {import('../core/Types').ElementLike} ElementLike
 *
 * @typedef {import('../core/EventBus').default} EventBus
 * @typedef {import('./CommandHandler').default} CommandHandler
 *
 * @typedef { any } CommandContext
 * @typedef { {
 *   new (...args: any[]) : CommandHandler
 * } } CommandHandlerConstructor
 * @typedef { {
 *   [key: string]: CommandHandler;
 * } } CommandHandlerMap
 * @typedef { {
 *   command: string;
 *   context: any;
 *   id?: any;
 * } } CommandStackAction
 * @typedef { {
 *   actions: CommandStackAction[];
 *   dirty: ElementLike[];
 *   trigger: 'execute' | 'undo' | 'redo' | 'clear' | null;
 *   atomic?: boolean;
 * } } CurrentExecution
 */

/**
 * A service that offers un- and redoable execution of commands.
 *
 * The command stack is responsible for executing modeling actions
 * in a un- and redoable manner. To do this it delegates the actual
 * command execution to {@link CommandHandler}s.
 *
 * Command handlers provide {@link CommandHandler#execute(ctx)} and
 * {@link CommandHandler#revert(ctx)} methods to un- and redo a command
 * identified by a command context.
 *
 *
 * ## Life-Cycle events
 *
 * In the process the command stack fires a number of life-cycle events
 * that other components to participate in the command execution.
 *
 *    * preExecute
 *    * preExecuted
 *    * execute
 *    * executed
 *    * postExecute
 *    * postExecuted
 *    * revert
 *    * reverted
 *
 * A special event is used for validating, whether a command can be
 * performed prior to its execution.
 *
 *    * canExecute
 *
 * Each of the events is fired as `commandStack.{eventName}` and
 * `commandStack.{commandName}.{eventName}`, respectively. This gives
 * components fine grained control on where to hook into.
 *
 * The event object fired transports `command`, the name of the
 * command and `context`, the command context.
 *
 *
 * ## Creating Command Handlers
 *
 * Command handlers should provide the {@link CommandHandler#execute(ctx)}
 * and {@link CommandHandler#revert(ctx)} methods to implement
 * redoing and undoing of a command.
 *
 * A command handler _must_ ensure undo is performed properly in order
 * not to break the undo chain. It must also return the shapes that
 * got changed during the `execute` and `revert` operations.
 *
 * Command handlers may execute other modeling operations (and thus
 * commands) in their `preExecute(d)` and `postExecute(d)` phases. The command
 * stack will properly group all commands together into a logical unit
 * that may be re- and undone atomically.
 *
 * Command handlers must not execute other commands from within their
 * core implementation (`execute`, `revert`).
 *
 *
 * ## Change Tracking
 *
 * During the execution of the CommandStack it will keep track of all
 * elements that have been touched during the command's execution.
 *
 * At the end of the CommandStack execution it will notify interested
 * components via an 'elements.changed' event with all the dirty
 * elements.
 *
 * The event can be picked up by components that are interested in the fact
 * that elements have been changed. One use case for this is updating
 * their graphical representation after moving / resizing or deletion.
 *
 * @see CommandHandler
 *
 * @param {EventBus} eventBus
 * @param {Injector} injector
 */
function CommandStack(eventBus, injector) {
  /**
   * A map of all registered command handlers.
   *
   * @type {CommandHandlerMap}
   */
  this._handlerMap = {};

  /**
   * A stack containing all re/undoable actions on the diagram
   *
   * @type {CommandStackAction[]}
   */
  this._stack = [];

  /**
   * The current index on the stack
   *
   * @type {number}
   */
  this._stackIdx = -1;

  /**
   * Current active commandStack execution
   *
   * @type {CurrentExecution}
   */
  this._currentExecution = {
    actions: [],
    dirty: [],
    trigger: null
  };

  /**
   * @type {Injector}
   */
  this._injector = injector;

  /**
   * @type EventBus
   */
  this._eventBus = eventBus;

  /**
   * @type { number }
   */
  this._uid = 1;
  eventBus.on(['diagram.destroy', 'diagram.clear'], function () {
    this.clear(false);
  }, this);
}
CommandStack.$inject = ['eventBus', 'injector'];

/**
 * Execute a command.
 *
 * @param {string} command The command to execute.
 * @param {CommandContext} context The context with which to execute the command.
 */
CommandStack.prototype.execute = function (command, context) {
  if (!command) {
    throw new Error('command required');
  }
  this._currentExecution.trigger = 'execute';
  const action = {
    command: command,
    context: context
  };
  this._pushAction(action);
  this._internalExecute(action);
  this._popAction();
};

/**
 * Check whether a command can be executed.
 *
 * Implementors may hook into the mechanism on two ways:
 *
 *   * in event listeners:
 *
 *     Users may prevent the execution via an event listener.
 *     It must prevent the default action for `commandStack.(<command>.)canExecute` events.
 *
 *   * in command handlers:
 *
 *     If the method {@link CommandHandler#canExecute} is implemented in a handler
 *     it will be called to figure out whether the execution is allowed.
 *
 * @param {string} command The command to execute.
 * @param {CommandContext} context The context with which to execute the command.
 *
 * @return {boolean} Whether the command can be executed with the given context.
 */
CommandStack.prototype.canExecute = function (command, context) {
  const action = {
    command: command,
    context: context
  };
  const handler = this._getHandler(command);
  let result = this._fire(command, 'canExecute', action);

  // handler#canExecute will only be called if no listener
  // decided on a result already
  if (result === undefined) {
    if (!handler) {
      return false;
    }
    if (handler.canExecute) {
      result = handler.canExecute(context);
    }
  }
  return result;
};

/**
 * Clear the command stack, erasing all undo / redo history.
 *
 * @param {boolean} [emit=true] Whether to fire an event. Defaults to `true`.
 */
CommandStack.prototype.clear = function (emit) {
  this._stack.length = 0;
  this._stackIdx = -1;
  if (emit !== false) {
    this._fire('changed', {
      trigger: 'clear'
    });
  }
};

/**
 * Undo last command(s)
 */
CommandStack.prototype.undo = function () {
  let action = this._getUndoAction(),
    next;
  if (action) {
    this._currentExecution.trigger = 'undo';
    this._pushAction(action);
    while (action) {
      this._internalUndo(action);
      next = this._getUndoAction();
      if (!next || next.id !== action.id) {
        break;
      }
      action = next;
    }
    this._popAction();
  }
};

/**
 * Redo last command(s)
 */
CommandStack.prototype.redo = function () {
  let action = this._getRedoAction(),
    next;
  if (action) {
    this._currentExecution.trigger = 'redo';
    this._pushAction(action);
    while (action) {
      this._internalExecute(action, true);
      next = this._getRedoAction();
      if (!next || next.id !== action.id) {
        break;
      }
      action = next;
    }
    this._popAction();
  }
};

/**
 * Register a handler instance with the command stack.
 *
 * @param {string} command Command to be executed.
 * @param {CommandHandler} handler Handler to execute the command.
 */
CommandStack.prototype.register = function (command, handler) {
  this._setHandler(command, handler);
};

/**
 * Register a handler type with the command stack  by instantiating it and
 * injecting its dependencies.
 *
 * @param {string} command Command to be executed.
 * @param {CommandHandlerConstructor} handlerCls Constructor to instantiate a {@link CommandHandler}.
 */
CommandStack.prototype.registerHandler = function (command, handlerCls) {
  if (!command || !handlerCls) {
    throw new Error('command and handlerCls must be defined');
  }
  const handler = this._injector.instantiate(handlerCls);
  this.register(command, handler);
};

/**
 * @return {boolean}
 */
CommandStack.prototype.canUndo = function () {
  return !!this._getUndoAction();
};

/**
 * @return {boolean}
 */
CommandStack.prototype.canRedo = function () {
  return !!this._getRedoAction();
};

// stack access  //////////////////////

CommandStack.prototype._getRedoAction = function () {
  return this._stack[this._stackIdx + 1];
};
CommandStack.prototype._getUndoAction = function () {
  return this._stack[this._stackIdx];
};

// internal functionality //////////////////////

CommandStack.prototype._internalUndo = function (action) {
  const command = action.command,
    context = action.context;
  const handler = this._getHandler(command);

  // guard against illegal nested command stack invocations
  this._atomicDo(() => {
    this._fire(command, 'revert', action);
    if (handler.revert) {
      this._markDirty(handler.revert(context));
    }
    this._revertedAction(action);
    this._fire(command, 'reverted', action);
  });
};
CommandStack.prototype._fire = function (command, qualifier, event) {
  if (arguments.length < 3) {
    event = qualifier;
    qualifier = null;
  }
  const names = qualifier ? [command + '.' + qualifier, qualifier] : [command];
  let result;
  event = this._eventBus.createEvent(event);
  for (const name of names) {
    result = this._eventBus.fire('commandStack.' + name, event);
    if (event.cancelBubble) {
      break;
    }
  }
  return result;
};
CommandStack.prototype._createId = function () {
  return this._uid++;
};
CommandStack.prototype._atomicDo = function (fn) {
  const execution = this._currentExecution;
  execution.atomic = true;
  try {
    fn();
  } finally {
    execution.atomic = false;
  }
};
CommandStack.prototype._internalExecute = function (action, redo) {
  const command = action.command,
    context = action.context;
  const handler = this._getHandler(command);
  if (!handler) {
    throw new Error('no command handler registered for <' + command + '>');
  }
  this._pushAction(action);
  if (!redo) {
    this._fire(command, 'preExecute', action);
    if (handler.preExecute) {
      handler.preExecute(context);
    }
    this._fire(command, 'preExecuted', action);
  }

  // guard against illegal nested command stack invocations
  this._atomicDo(() => {
    this._fire(command, 'execute', action);
    if (handler.execute) {
      // actual execute + mark return results as dirty
      this._markDirty(handler.execute(context));
    }

    // log to stack
    this._executedAction(action, redo);
    this._fire(command, 'executed', action);
  });
  if (!redo) {
    this._fire(command, 'postExecute', action);
    if (handler.postExecute) {
      handler.postExecute(context);
    }
    this._fire(command, 'postExecuted', action);
  }
  this._popAction();
};
CommandStack.prototype._pushAction = function (action) {
  const execution = this._currentExecution,
    actions = execution.actions;
  const baseAction = actions[0];
  if (execution.atomic) {
    throw new Error('illegal invocation in <execute> or <revert> phase (action: ' + action.command + ')');
  }
  if (!action.id) {
    action.id = baseAction && baseAction.id || this._createId();
  }
  actions.push(action);
};
CommandStack.prototype._popAction = function () {
  const execution = this._currentExecution,
    trigger = execution.trigger,
    actions = execution.actions,
    dirty = execution.dirty;
  actions.pop();
  if (!actions.length) {
    this._eventBus.fire('elements.changed', {
      elements: uniqueBy('id', dirty.reverse())
    });
    dirty.length = 0;
    this._fire('changed', {
      trigger: trigger
    });
    execution.trigger = null;
  }
};
CommandStack.prototype._markDirty = function (elements) {
  const execution = this._currentExecution;
  if (!elements) {
    return;
  }
  elements = isArray(elements) ? elements : [elements];
  execution.dirty = execution.dirty.concat(elements);
};
CommandStack.prototype._executedAction = function (action, redo) {
  const stackIdx = ++this._stackIdx;
  if (!redo) {
    this._stack.splice(stackIdx, this._stack.length, action);
  }
};
CommandStack.prototype._revertedAction = function (action) {
  this._stackIdx--;
};
CommandStack.prototype._getHandler = function (command) {
  return this._handlerMap[command];
};
CommandStack.prototype._setHandler = function (command, handler) {
  if (!command || !handler) {
    throw new Error('command and handler required');
  }
  if (this._handlerMap[command]) {
    throw new Error('overriding handler for command <' + command + '>');
  }
  this._handlerMap[command] = handler;
};

/**
 * @type { import('didi').ModuleDeclaration }
 */
var commandModule = {
  commandStack: ['type', CommandStack]
};

class UpdateFieldValidationHandler {
  constructor(form, validator) {
    this._form = form;
    this._validator = validator;
  }
  execute(context) {
    const {
      field,
      value,
      indexes
    } = context;
    const {
      errors
    } = this._form._getState();
    context.oldErrors = clone(errors);
    const fieldErrors = this._validator.validateField(field, value);
    const updatedErrors = set(errors, [field.id, ...Object.values(indexes || {})], fieldErrors.length ? fieldErrors : undefined);
    this._form._setState({
      errors: updatedErrors
    });
  }
  revert(context) {
    this._form._setState({
      errors: context.oldErrors
    });
  }
}
UpdateFieldValidationHandler.$inject = ['form', 'validator'];

class ViewerCommands {
  constructor(commandStack, eventBus) {
    this._commandStack = commandStack;
    eventBus.on('form.init', () => {
      this.registerHandlers();
    });
  }
  registerHandlers() {
    Object.entries(this.getHandlers()).forEach(([id, handler]) => {
      this._commandStack.registerHandler(id, handler);
    });
  }
  getHandlers() {
    return {
      'formField.validation.update': UpdateFieldValidationHandler
    };
  }
  updateFieldValidation(field, value, indexes) {
    const context = {
      field,
      value,
      indexes
    };
    this._commandStack.execute('formField.validation.update', context);
  }
}
ViewerCommands.$inject = ['commandStack', 'eventBus'];

const ViewerCommandsModule = {
  __depends__: [commandModule],
  __init__: ['viewerCommands'],
  viewerCommands: ['type', ViewerCommands]
};

var _path$3;
function _extends$3() { _extends$3 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$3.apply(this, arguments); }
var SvgExpand = function SvgExpand(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$3({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none"
  }, props), _path$3 || (_path$3 = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "M2 9h5.5v3.086l-1.293-1.293-.707.707L8 14l2.5-2.5-.707-.707L8.5 12.086V9H14V8H2v1Zm11-7H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Zm0 3H3V3h10v2Z"
  })));
};
var ExpandSvg = SvgExpand;

var _path$2;
function _extends$2() { _extends$2 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$2.apply(this, arguments); }
var SvgCollapse = function SvgCollapse(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$2({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none"
  }, props), _path$2 || (_path$2 = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "M13 10H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Zm0 3H3v-2h10v2ZM8.5 3.914l1.293 1.293.707-.707L8 2 5.5 4.5l.707.707L7.5 3.914V7H2v1h12V7H8.5V3.914Z"
  })));
};
var CollapseSvg = SvgCollapse;

var _path$1, _path2;
function _extends$1() { _extends$1 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$1.apply(this, arguments); }
var SvgAdd = function SvgAdd(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$1({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none"
  }, props), _path$1 || (_path$1 = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "M8 2c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6 2.7-6 6-6Zm0-1C4.15 1 1 4.15 1 8s3.15 7 7 7 7-3.15 7-7-3.15-7-7-7Z"
  })), _path2 || (_path2 = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "M12 7.5H8.5V4h-1v3.5H4v1h3.5V12h1V8.5H12v-1Z"
  })));
};
var AddSvg = SvgAdd;

var _path;
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
var SvgDelete = function SvgDelete(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none"
  }, props), _path || (_path = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "m12 4.7-.7-.7L8 7.3 4.7 4l-.7.7L7.3 8 4 11.3l.7.7L8 8.7l3.3 3.3.7-.7L8.7 8 12 4.7Z"
  })));
};
var DeleteSvg = SvgDelete;

// disable react hook rules as the linter is confusing the functional components within a class as class components
class RepeatRenderManager {
  constructor(form, formFields, formFieldRegistry, pathRegistry) {
    this._form = form;
    this._formFields = formFields;
    this._formFieldRegistry = formFieldRegistry;
    this._pathRegistry = pathRegistry;
    this.Repeater = this.Repeater.bind(this);
    this.RepeatFooter = this.RepeatFooter.bind(this);
  }

  /**
   * Checks whether a field is currently repeating its children.
   *
   * @param {string} id - The id of the field to check
   * @returns {boolean} - True if repeatable, false otherwise
   */
  isFieldRepeating(id) {
    if (!id) {
      return false;
    }
    const formField = this._formFieldRegistry.get(id);
    const formFieldDefinition = this._formFields.get(formField.type);
    return formFieldDefinition.config.repeatable && formField.isRepeating;
  }
  Repeater(props) {
    const {
      RowsRenderer,
      indexes,
      useSharedState,
      ...restProps
    } = props;
    const [sharedRepeatState] = useSharedState;
    const {
      data
    } = this._form._getState();
    const repeaterField = props.field;
    const dataPath = this._pathRegistry.getValuePath(repeaterField, {
      indexes
    });
    const values = get(data, dataPath) || [];
    const nonCollapsedItems = this._getNonCollapsedItems(repeaterField);
    const collapseEnabled = !repeaterField.disableCollapse && values.length > nonCollapsedItems;
    const isCollapsed = collapseEnabled && sharedRepeatState.isCollapsed;
    const hasChildren = repeaterField.components && repeaterField.components.length > 0;
    const showRemove = repeaterField.allowAddRemove && hasChildren;
    const displayValues = isCollapsed ? values.slice(0, nonCollapsedItems) : values;
    const onDeleteItem = index => {
      const updatedValues = values.slice();
      updatedValues.splice(index, 1);
      props.onChange({
        field: repeaterField,
        value: updatedValues,
        indexes
      });
    };
    const parentExpressionContextInfo = useContext(LocalExpressionContext);
    return jsx(Fragment, {
      children: displayValues.map((itemValue, itemIndex) => jsx(RepetitionScaffold, {
        itemIndex: itemIndex,
        itemValue: itemValue,
        parentExpressionContextInfo: parentExpressionContextInfo,
        repeaterField: repeaterField,
        RowsRenderer: RowsRenderer,
        indexes: indexes,
        onDeleteItem: onDeleteItem,
        showRemove: showRemove,
        ...restProps
      }, itemIndex))
    });
  }
  RepeatFooter(props) {
    const addButtonRef = useRef(null);
    const {
      useSharedState,
      indexes,
      field: repeaterField,
      readonly,
      disabled
    } = props;
    const [sharedRepeatState, setSharedRepeatState] = useSharedState;
    const {
      data
    } = this._form._getState();
    const dataPath = this._pathRegistry.getValuePath(repeaterField, {
      indexes
    });
    const values = get(data, dataPath) || [];
    const nonCollapsedItems = this._getNonCollapsedItems(repeaterField);
    const collapseEnabled = !repeaterField.disableCollapse && values.length > nonCollapsedItems;
    const isCollapsed = collapseEnabled && sharedRepeatState.isCollapsed;
    const hasChildren = repeaterField.components && repeaterField.components.length > 0;
    const showAdd = repeaterField.allowAddRemove && hasChildren;
    const toggle = () => {
      setSharedRepeatState(state => ({
        ...state,
        isCollapsed: !isCollapsed
      }));
    };
    const shouldScroll = useRef(false);
    const onAddItem = () => {
      const updatedValues = values.slice();
      const newItem = this._form._getInitializedFieldData(this._form._getState().data, {
        container: repeaterField,
        indexes: {
          ...indexes,
          [repeaterField.id]: updatedValues.length
        }
      });
      updatedValues.push(newItem);
      shouldScroll.current = true;
      props.onChange({
        field: repeaterField,
        value: updatedValues,
        indexes
      });
      setSharedRepeatState(state => ({
        ...state,
        isCollapsed: false
      }));
    };
    useScrollIntoView(addButtonRef, [values.length], {
      align: 'bottom',
      behavior: 'auto',
      offset: 20
    }, [shouldScroll]);
    return jsxs("div", {
      className: classNames('fjs-repeat-render-footer', {
        'fjs-remove-allowed': repeaterField.allowAddRemove
      }),
      children: [showAdd ? jsx("button", {
        type: "button",
        readOnly: readonly,
        disabled: disabled || readonly,
        class: "fjs-repeat-render-add",
        ref: addButtonRef,
        onClick: onAddItem,
        children: jsxs(Fragment, {
          children: [jsx(AddSvg, {}), " ", 'Přidat']
        })
      }) : null, collapseEnabled ? jsx("button", {
        type: "button",
        class: "fjs-repeat-render-collapse",
        onClick: toggle,
        children: isCollapsed ? jsxs(Fragment, {
          children: [jsx(ExpandSvg, {}), " ", `Rozbalit vše (${values.length})`]
        }) : jsxs(Fragment, {
          children: [jsx(CollapseSvg, {}), " ", 'Sbalit']
        })
      }) : null]
    });
  }
  _getNonCollapsedItems(field) {
    const DEFAULT_NON_COLLAPSED_ITEMS = 5;
    const {
      nonCollapsedItems
    } = field;
    return nonCollapsedItems ? nonCollapsedItems : DEFAULT_NON_COLLAPSED_ITEMS;
  }
}

/**
 * Individual repetition of a repeated field and context scaffolding.
 *
 * @param {Object} props
 * @param {number} props.itemIndex
 * @param {Object} props.itemValue
 * @param {Object} props.parentExpressionContextInfo
 * @param {Object} props.repeaterField
 * @param {Function} props.RowsRenderer
 * @param {Object} props.indexes
 * @param {Function} props.onDeleteItem
 * @param {boolean} props.showRemove
 */

const RepetitionScaffold = props => {
  const {
    itemIndex,
    itemValue,
    parentExpressionContextInfo,
    repeaterField,
    RowsRenderer,
    indexes,
    onDeleteItem,
    showRemove,
    ...restProps
  } = props;
  const elementProps = useMemo(() => ({
    ...restProps,
    indexes: {
      ...(indexes || {}),
      [repeaterField.id]: itemIndex
    }
  }), [itemIndex, indexes, repeaterField.id, restProps]);
  const localExpressionContextInfo = useMemo(() => ({
    data: parentExpressionContextInfo.data,
    this: itemValue,
    parent: buildExpressionContext(parentExpressionContextInfo),
    i: [...parentExpressionContextInfo.i, itemIndex + 1]
  }), [itemIndex, parentExpressionContextInfo, itemValue]);
  return !showRemove ? jsx(LocalExpressionContext.Provider, {
    value: localExpressionContextInfo,
    children: jsx(RowsRenderer, {
      ...elementProps
    })
  }) : jsxs("div", {
    class: "fjs-repeat-row-container",
    children: [jsx("div", {
      class: "fjs-repeat-row-rows",
      children: jsx(LocalExpressionContext.Provider, {
        value: localExpressionContextInfo,
        children: jsx(RowsRenderer, {
          ...elementProps
        })
      })
    }), jsx("button", {
      type: "button",
      class: "fjs-repeat-row-remove",
      "aria-label": `Remove list item ${itemIndex + 1}`,
      onClick: () => onDeleteItem(itemIndex),
      children: jsx("div", {
        class: "fjs-repeat-row-remove-icon-container",
        children: jsx(DeleteSvg, {})
      })
    })]
  });
};
RepeatRenderManager.$inject = ['form', 'formFields', 'formFieldRegistry', 'pathRegistry'];

const RepeatRenderModule = {
  __init__: ['repeatRenderManager'],
  repeatRenderManager: ['type', RepeatRenderManager]
};

var FN_REF = '__fn';
var DEFAULT_PRIORITY = 1000;
var slice = Array.prototype.slice;

/**
 * @typedef { {
 *   stopPropagation(): void;
 *   preventDefault(): void;
 *   cancelBubble: boolean;
 *   defaultPrevented: boolean;
 *   returnValue: any;
 * } } Event
 */

/**
 * @template E
 *
 * @typedef { (event: E & Event, ...any) => any } EventBusEventCallback
 */

/**
 * @typedef { {
 *  priority: number;
 *  next: EventBusListener | null;
 *  callback: EventBusEventCallback<any>;
 * } } EventBusListener
 */

/**
 * A general purpose event bus.
 *
 * This component is used to communicate across a diagram instance.
 * Other parts of a diagram can use it to listen to and broadcast events.
 *
 *
 * ## Registering for Events
 *
 * The event bus provides the {@link EventBus#on} and {@link EventBus#once}
 * methods to register for events. {@link EventBus#off} can be used to
 * remove event registrations. Listeners receive an instance of {@link Event}
 * as the first argument. It allows them to hook into the event execution.
 *
 * ```javascript
 *
 * // listen for event
 * eventBus.on('foo', function(event) {
 *
 *   // access event type
 *   event.type; // 'foo'
 *
 *   // stop propagation to other listeners
 *   event.stopPropagation();
 *
 *   // prevent event default
 *   event.preventDefault();
 * });
 *
 * // listen for event with custom payload
 * eventBus.on('bar', function(event, payload) {
 *   console.log(payload);
 * });
 *
 * // listen for event returning value
 * eventBus.on('foobar', function(event) {
 *
 *   // stop event propagation + prevent default
 *   return false;
 *
 *   // stop event propagation + return custom result
 *   return {
 *     complex: 'listening result'
 *   };
 * });
 *
 *
 * // listen with custom priority (default=1000, higher is better)
 * eventBus.on('priorityfoo', 1500, function(event) {
 *   console.log('invoked first!');
 * });
 *
 *
 * // listen for event and pass the context (`this`)
 * eventBus.on('foobar', function(event) {
 *   this.foo();
 * }, this);
 * ```
 *
 *
 * ## Emitting Events
 *
 * Events can be emitted via the event bus using {@link EventBus#fire}.
 *
 * ```javascript
 *
 * // false indicates that the default action
 * // was prevented by listeners
 * if (eventBus.fire('foo') === false) {
 *   console.log('default has been prevented!');
 * };
 *
 *
 * // custom args + return value listener
 * eventBus.on('sum', function(event, a, b) {
 *   return a + b;
 * });
 *
 * // you can pass custom arguments + retrieve result values.
 * var sum = eventBus.fire('sum', 1, 2);
 * console.log(sum); // 3
 * ```
 *
 * @template [EventMap=null]
 */
function EventBus() {
  /**
   * @type { Record<string, EventBusListener> }
   */
  this._listeners = {};

  // cleanup on destroy on lowest priority to allow
  // message passing until the bitter end
  this.on('diagram.destroy', 1, this._destroy, this);
}

/**
 * @overlord
 *
 * Register an event listener for events with the given name.
 *
 * The callback will be invoked with `event, ...additionalArguments`
 * that have been passed to {@link EventBus#fire}.
 *
 * Returning false from a listener will prevent the events default action
 * (if any is specified). To stop an event from being processed further in
 * other listeners execute {@link Event#stopPropagation}.
 *
 * Returning anything but `undefined` from a listener will stop the listener propagation.
 *
 * @template T
 *
 * @param {string|string[]} events to subscribe to
 * @param {number} [priority=1000] listen priority
 * @param {EventBusEventCallback<T>} callback
 * @param {any} [that] callback context
 */
/**
 * Register an event listener for events with the given name.
 *
 * The callback will be invoked with `event, ...additionalArguments`
 * that have been passed to {@link EventBus#fire}.
 *
 * Returning false from a listener will prevent the events default action
 * (if any is specified). To stop an event from being processed further in
 * other listeners execute {@link Event#stopPropagation}.
 *
 * Returning anything but `undefined` from a listener will stop the listener propagation.
 *
 * @template {keyof EventMap} EventName
 *
 * @param {EventName} events to subscribe to
 * @param {number} [priority=1000] listen priority
 * @param {EventBusEventCallback<EventMap[EventName]>} callback
 * @param {any} [that] callback context
 */
EventBus.prototype.on = function (events, priority, callback, that) {
  events = isArray(events) ? events : [events];
  if (isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY;
  }
  if (!isNumber(priority)) {
    throw new Error('priority must be a number');
  }
  var actualCallback = callback;
  if (that) {
    actualCallback = bind(callback, that);

    // make sure we remember and are able to remove
    // bound callbacks via {@link #off} using the original
    // callback
    actualCallback[FN_REF] = callback[FN_REF] || callback;
  }
  var self = this;
  events.forEach(function (e) {
    self._addListener(e, {
      priority: priority,
      callback: actualCallback,
      next: null
    });
  });
};

/**
 * @overlord
 *
 * Register an event listener that is called only once.
 *
 * @template T
 *
 * @param {string|string[]} events to subscribe to
 * @param {number} [priority=1000] the listen priority
 * @param {EventBusEventCallback<T>} callback
 * @param {any} [that] callback context
 */
/**
 * Register an event listener that is called only once.
 *
 * @template {keyof EventMap} EventName
 *
 * @param {EventName} events to subscribe to
 * @param {number} [priority=1000] listen priority
 * @param {EventBusEventCallback<EventMap[EventName]>} callback
 * @param {any} [that] callback context
 */
EventBus.prototype.once = function (events, priority, callback, that) {
  var self = this;
  if (isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY;
  }
  if (!isNumber(priority)) {
    throw new Error('priority must be a number');
  }
  function wrappedCallback() {
    wrappedCallback.__isTomb = true;
    var result = callback.apply(that, arguments);
    self.off(events, wrappedCallback);
    return result;
  }

  // make sure we remember and are able to remove
  // bound callbacks via {@link #off} using the original
  // callback
  wrappedCallback[FN_REF] = callback;
  this.on(events, priority, wrappedCallback);
};

/**
 * Removes event listeners by event and callback.
 *
 * If no callback is given, all listeners for a given event name are being removed.
 *
 * @param {string|string[]} events
 * @param {EventBusEventCallback} [callback]
 */
EventBus.prototype.off = function (events, callback) {
  events = isArray(events) ? events : [events];
  var self = this;
  events.forEach(function (event) {
    self._removeListener(event, callback);
  });
};

/**
 * Create an event recognized be the event bus.
 *
 * @param {Object} data Event data.
 *
 * @return {Event} An event that will be recognized by the event bus.
 */
EventBus.prototype.createEvent = function (data) {
  var event = new InternalEvent();
  event.init(data);
  return event;
};

/**
 * Fires an event.
 *
 * @example
 *
 * ```javascript
 * // fire event by name
 * events.fire('foo');
 *
 * // fire event object with nested type
 * var event = { type: 'foo' };
 * events.fire(event);
 *
 * // fire event with explicit type
 * var event = { x: 10, y: 20 };
 * events.fire('element.moved', event);
 *
 * // pass additional arguments to the event
 * events.on('foo', function(event, bar) {
 *   alert(bar);
 * });
 *
 * events.fire({ type: 'foo' }, 'I am bar!');
 * ```
 *
 * @param {string} [type] event type
 * @param {Object} [data] event or event data
 * @param {...any} [args] additional arguments the callback will be called with.
 *
 * @return {any} The return value. Will be set to `false` if the default was prevented.
 */
EventBus.prototype.fire = function (type, data) {
  var event, firstListener, returnValue, args;
  args = slice.call(arguments);
  if (typeof type === 'object') {
    data = type;
    type = data.type;
  }
  if (!type) {
    throw new Error('no event type specified');
  }
  firstListener = this._listeners[type];
  if (!firstListener) {
    return;
  }

  // we make sure we fire instances of our home made
  // events here. We wrap them only once, though
  if (data instanceof InternalEvent) {
    // we are fine, we alread have an event
    event = data;
  } else {
    event = this.createEvent(data);
  }

  // ensure we pass the event as the first parameter
  args[0] = event;

  // original event type (in case we delegate)
  var originalType = event.type;

  // update event type before delegation
  if (type !== originalType) {
    event.type = type;
  }
  try {
    returnValue = this._invokeListeners(event, args, firstListener);
  } finally {
    // reset event type after delegation
    if (type !== originalType) {
      event.type = originalType;
    }
  }

  // set the return value to false if the event default
  // got prevented and no other return value exists
  if (returnValue === undefined && event.defaultPrevented) {
    returnValue = false;
  }
  return returnValue;
};

/**
 * Handle an error by firing an event.
 *
 * @param {Error} error The error to be handled.
 *
 * @return {boolean} Whether the error was handled.
 */
EventBus.prototype.handleError = function (error) {
  return this.fire('error', {
    error: error
  }) === false;
};
EventBus.prototype._destroy = function () {
  this._listeners = {};
};

/**
 * @param {Event} event
 * @param {any[]} args
 * @param {EventBusListener} listener
 *
 * @return {any}
 */
EventBus.prototype._invokeListeners = function (event, args, listener) {
  var returnValue;
  while (listener) {
    // handle stopped propagation
    if (event.cancelBubble) {
      break;
    }
    returnValue = this._invokeListener(event, args, listener);
    listener = listener.next;
  }
  return returnValue;
};

/**
 * @param {Event} event
 * @param {any[]} args
 * @param {EventBusListener} listener
 *
 * @return {any}
 */
EventBus.prototype._invokeListener = function (event, args, listener) {
  var returnValue;
  if (listener.callback.__isTomb) {
    return returnValue;
  }
  try {
    // returning false prevents the default action
    returnValue = invokeFunction(listener.callback, args);

    // stop propagation on return value
    if (returnValue !== undefined) {
      event.returnValue = returnValue;
      event.stopPropagation();
    }

    // prevent default on return false
    if (returnValue === false) {
      event.preventDefault();
    }
  } catch (error) {
    if (!this.handleError(error)) {
      console.error('unhandled error in event listener', error);
      throw error;
    }
  }
  return returnValue;
};

/**
 * Add new listener with a certain priority to the list
 * of listeners (for the given event).
 *
 * The semantics of listener registration / listener execution are
 * first register, first serve: New listeners will always be inserted
 * after existing listeners with the same priority.
 *
 * Example: Inserting two listeners with priority 1000 and 1300
 *
 *    * before: [ 1500, 1500, 1000, 1000 ]
 *    * after: [ 1500, 1500, (new=1300), 1000, 1000, (new=1000) ]
 *
 * @param {string} event
 * @param {EventBusListener} newListener
 */
EventBus.prototype._addListener = function (event, newListener) {
  var listener = this._getListeners(event),
    previousListener;

  // no prior listeners
  if (!listener) {
    this._setListeners(event, newListener);
    return;
  }

  // ensure we order listeners by priority from
  // 0 (high) to n > 0 (low)
  while (listener) {
    if (listener.priority < newListener.priority) {
      newListener.next = listener;
      if (previousListener) {
        previousListener.next = newListener;
      } else {
        this._setListeners(event, newListener);
      }
      return;
    }
    previousListener = listener;
    listener = listener.next;
  }

  // add new listener to back
  previousListener.next = newListener;
};

/**
 * @param {string} name
 *
 * @return {EventBusListener}
 */
EventBus.prototype._getListeners = function (name) {
  return this._listeners[name];
};

/**
 * @param {string} name
 * @param {EventBusListener} listener
 */
EventBus.prototype._setListeners = function (name, listener) {
  this._listeners[name] = listener;
};
EventBus.prototype._removeListener = function (event, callback) {
  var listener = this._getListeners(event),
    nextListener,
    previousListener,
    listenerCallback;
  if (!callback) {
    // clear listeners
    this._setListeners(event, null);
    return;
  }
  while (listener) {
    nextListener = listener.next;
    listenerCallback = listener.callback;
    if (listenerCallback === callback || listenerCallback[FN_REF] === callback) {
      if (previousListener) {
        previousListener.next = nextListener;
      } else {
        // new first listener
        this._setListeners(event, nextListener);
      }
    }
    previousListener = listener;
    listener = nextListener;
  }
};

/**
 * A event that is emitted via the event bus.
 */
function InternalEvent() {}
InternalEvent.prototype.stopPropagation = function () {
  this.cancelBubble = true;
};
InternalEvent.prototype.preventDefault = function () {
  this.defaultPrevented = true;
};
InternalEvent.prototype.init = function (data) {
  assign(this, data || {});
};

/**
 * Invoke function. Be fast...
 *
 * @param {Function} fn
 * @param {any[]} args
 *
 * @return {any}
 */
function invokeFunction(fn, args) {
  return fn.apply(null, args);
}

const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_PATTERN = /(\+|00)(297|93|244|1264|358|355|376|971|54|374|1684|1268|61|43|994|257|32|229|226|880|359|973|1242|387|590|375|501|1441|591|55|1246|673|975|267|236|1|61|41|56|86|225|237|243|242|682|57|269|238|506|53|5999|61|1345|357|420|49|253|1767|45|1809|1829|1849|213|593|20|291|212|34|372|251|358|679|500|33|298|691|241|44|995|44|233|350|224|590|220|245|240|30|1473|299|502|594|1671|592|852|504|385|509|36|62|44|91|246|353|98|964|354|972|39|1876|44|962|81|76|77|254|996|855|686|1869|82|383|965|856|961|231|218|1758|423|94|266|370|352|371|853|590|212|377|373|261|960|52|692|389|223|356|95|382|976|1670|258|222|1664|596|230|265|60|262|264|687|227|672|234|505|683|31|47|977|674|64|968|92|507|64|51|63|680|675|48|1787|1939|850|351|595|970|689|974|262|40|7|250|966|249|221|65|500|4779|677|232|503|378|252|508|381|211|239|597|421|386|46|268|1721|248|963|1649|235|228|66|992|690|993|670|676|1868|216|90|688|886|255|256|380|598|1|998|3906698|379|1784|58|1284|1340|84|678|681|685|967|27|260|263)(9[976]\d|8[987530]\d|6[987]\d|5[90]\d|42\d|3[875]\d|2[98654321]\d|9[8543210]|8[6421]|6[6543210]|5[87654321]|4[987654310]|3[9643210]|2[70]|7|1)\d{4,20}$/;
const VALIDATE_FEEL_PROPERTIES = ['min', 'max', 'minLength', 'maxLength'];
class Validator {
  constructor(expressionLanguage, conditionChecker, form) {
    this._expressionLanguage = expressionLanguage;
    this._conditionChecker = conditionChecker;
    this._form = form;
  }
  validateField(field, value) {
    const {
      type,
      validate
    } = field;
    let errors = [];
    if (type === 'number') {
      const {
        decimalDigits,
        increment
      } = field;
      if (value === 'NaN') {
        errors = [...errors, 'Hodnota musí být platné číslo.'];
      } else if (value) {
        if (decimalDigits >= 0 && countDecimals(value) > decimalDigits) {
          errors = [...errors, 'Hodnota musí ' + (decimalDigits === 0 ? 'být platné celé číslo' : `obsahovat maximálně ${decimalDigits} desetinných míst`) + '.'];
        }
        if (increment) {
          const bigValue = Big(value);
          const bigIncrement = Big(increment);
          const offset = bigValue.mod(bigIncrement);
          if (offset.cmp(0) !== 0) {
            const previousValue = bigValue.minus(offset);
            const nextValue = previousValue.plus(bigIncrement);
            errors = [...errors, `Prosím, zvolte platnou hodnotu. Dvě nejbližší hodnoty jsou ${previousValue} a ${nextValue}.`];
          }
        }
      }
    }
    if (!validate) {
      return errors;
    }
    const evaluatedValidation = evaluateFEELValues(validate, this._expressionLanguage, this._conditionChecker, this._form);
    if (evaluatedValidation.pattern && value && !new RegExp(evaluatedValidation.pattern).test(value)) {
      errors = [...errors, `Hodnota splňovat regulární výraz ${evaluatedValidation.pattern}.`];
    }
    if (evaluatedValidation.required) {
      const isUncheckedCheckbox = type === 'checkbox' && value === false;
      const isUnsetValue = isNil(value) || value === '';
      const isEmptyMultiselect = Array.isArray(value) && value.length === 0;
      if (isUncheckedCheckbox || isUnsetValue || isEmptyMultiselect) {
        errors = [...errors, 'Povinné pole.'];
      }
    }
    if ('min' in evaluatedValidation && (value || value === 0) && value < evaluatedValidation.min) {
      errors = [...errors, `Hodnota musí být větší nebo rovna ${evaluatedValidation.min}.`];
    }
    if ('max' in evaluatedValidation && (value || value === 0) && value > evaluatedValidation.max) {
      errors = [...errors, `Hodnota musí být menší nebo rovna ${evaluatedValidation.max}.`];
    }
    if ('minLength' in evaluatedValidation && value && value.trim().length < evaluatedValidation.minLength) {
      errors = [...errors, `Hodnota musí být dlouhá alespoň ${evaluatedValidation.minLength} znaků.`];
    }
    if ('maxLength' in evaluatedValidation && value && value.trim().length > evaluatedValidation.maxLength) {
      errors = [...errors, `Hodnota nesmí být delší než ${evaluatedValidation.maxLength} znaků.`];
    }
    if ('validationType' in evaluatedValidation && value && evaluatedValidation.validationType === 'phone' && !PHONE_PATTERN.test(value)) {
      errors = [...errors, 'Hodnota musí být platné mezinárodní telefonní číslo. (např. +4930664040900)'];
    }
    if ('validationType' in evaluatedValidation && value && evaluatedValidation.validationType === 'email' && !EMAIL_PATTERN.test(value)) {
      errors = [...errors, 'Hodnota musí být platný email.'];
    }
    return errors;
  }
}
Validator.$inject = ['expressionLanguage', 'conditionChecker', 'form'];

// helpers //////////

/**
 * Helper function to evaluate optional FEEL validation values.
 */
function evaluateFEELValues(validate, expressionLanguage, conditionChecker, form) {
  const evaluatedValidate = {
    ...validate
  };
  VALIDATE_FEEL_PROPERTIES.forEach(property => {
    const path = property.split('.');
    const value = get(evaluatedValidate, path);

    // mirroring FEEL evaluation of our hooks
    if (!expressionLanguage || !expressionLanguage.isExpression(value)) {
      return value;
    }
    const {
      initialData,
      data
    } = form._getState();
    const newData = conditionChecker ? conditionChecker.applyConditions(data, data) : data;
    const filteredData = {
      ...initialData,
      ...newData
    };
    const evaluatedValue = expressionLanguage.evaluate(value, filteredData);

    // replace validate property with evaluated value
    if (evaluatedValue) {
      set(evaluatedValidate, path, evaluatedValue);
    }
  });
  return evaluatedValidate;
}

class Importer {
  /**
   * @constructor
   * @param { import('./FormFieldRegistry').FormFieldRegistry } formFieldRegistry
   * @param { import('./PathRegistry').PathRegistry } pathRegistry
   * @param { import('./FieldFactory').FieldFactory } fieldFactory
   * @param { import('./FormLayouter').FormLayouter } formLayouter
   */
  constructor(formFieldRegistry, pathRegistry, fieldFactory, formLayouter) {
    this._formFieldRegistry = formFieldRegistry;
    this._pathRegistry = pathRegistry;
    this._fieldFactory = fieldFactory;
    this._formLayouter = formLayouter;
  }

  /**
   * Import schema creating rows, fields, attaching additional
   * information to each field and adding fields to the
   * field registry.
   *
   * Additional information attached:
   *
   *   * `id` (unless present)
   *   * `_parent`
   *   * `_path`
   *
   * @param {any} schema
   *
   * @typedef {{ warnings: Error[], schema: any }} ImportResult
   * @returns {ImportResult}
   */
  importSchema(schema) {
    // TODO: Add warnings
    const warnings = [];
    try {
      this._cleanup();
      const importedSchema = this.importFormField(clone(schema));
      this._formLayouter.calculateLayout(clone(importedSchema));
      return {
        schema: importedSchema,
        warnings
      };
    } catch (err) {
      this._cleanup();
      err.warnings = warnings;
      throw err;
    }
  }
  _cleanup() {
    this._formLayouter.clear();
    this._formFieldRegistry.clear();
    this._pathRegistry.clear();
  }

  /**
   * @param {{[x: string]: any}} fieldAttrs
   * @param {String} [parentId]
   * @param {number} [index]
   *
   * @return {any} field
   */
  importFormField(fieldAttrs, parentId, index) {
    const {
      components
    } = fieldAttrs;
    let parent, path;
    if (parentId) {
      parent = this._formFieldRegistry.get(parentId);
    }

    // set form field path
    path = parent ? [...parent._path, 'components', index] : [];
    const field = this._fieldFactory.create({
      ...fieldAttrs,
      _path: path,
      _parent: parentId
    }, false);
    this._formFieldRegistry.add(field);
    if (components) {
      field.components = this.importFormFields(components, field.id);
    }
    return field;
  }

  /**
   * @param {Array<any>} components
   * @param {string} parentId
   *
   * @return {Array<any>} imported components
   */
  importFormFields(components, parentId) {
    return components.map((component, index) => {
      return this.importFormField(component, parentId, index);
    });
  }
}
Importer.$inject = ['formFieldRegistry', 'pathRegistry', 'fieldFactory', 'formLayouter'];

class FieldFactory {
  /**
   * @constructor
   *
   * @param  formFieldRegistry
   * @param  formFields
   */
  constructor(formFieldRegistry, pathRegistry, formFields) {
    this._formFieldRegistry = formFieldRegistry;
    this._pathRegistry = pathRegistry;
    this._formFields = formFields;
  }
  create(attrs, applyDefaults = true) {
    const {
      id,
      type,
      key,
      path,
      _parent
    } = attrs;
    const fieldDefinition = this._formFields.get(type);
    if (!fieldDefinition) {
      throw new Error(`form field of type <${type}> not supported`);
    }
    const {
      config
    } = fieldDefinition;
    if (!config) {
      throw new Error(`form field of type <${type}> has no config`);
    }
    if (id && this._formFieldRegistry._ids.assigned(id)) {
      throw new Error(`form field with id <${id}> already exists`);
    }

    // ensure that we can claim the path

    const parent = _parent && this._formFieldRegistry.get(_parent);
    const parentPath = parent && this._pathRegistry.getValuePath(parent) || [];
    const knownAncestorIds = getAncestryList(_parent, this._formFieldRegistry);
    if (config.keyed && key && !this._pathRegistry.canClaimPath([...parentPath, ...key.split('.')], {
      isClosed: true,
      knownAncestorIds
    })) {
      throw new Error(`binding path '${[...parentPath, key].join('.')}' is already claimed`);
    }
    if (config.pathed && path && !this._pathRegistry.canClaimPath([...parentPath, ...path.split('.')], {
      isRepeatable: config.repeatable,
      knownAncestorIds
    })) {
      throw new Error(`binding path '${[...parentPath, ...path.split('.')].join('.')}' is already claimed`);
    }
    const labelAttrs = applyDefaults && config.label ? {
      label: config.label
    } : {};
    const field = config.create({
      ...labelAttrs,
      ...attrs
    });
    this._ensureId(field);
    if (config.keyed) {
      this._ensureKey(field);
      this._pathRegistry.claimPath(this._pathRegistry.getValuePath(field), {
        isClosed: true,
        claimerId: field.id,
        knownAncestorIds: getAncestryList(_parent, this._formFieldRegistry)
      });
    }
    if (config.pathed) {
      if (config.repeatable) {
        this._enforceDefaultPath(field);
      }
      if (field.path) {
        this._pathRegistry.claimPath(this._pathRegistry.getValuePath(field), {
          isRepeatable: config.repeatable,
          claimerId: field.id,
          knownAncestorIds: getAncestryList(_parent, this._formFieldRegistry)
        });
      }
    }
    return field;
  }
  _ensureId(field) {
    if (field.id) {
      this._formFieldRegistry._ids.claim(field.id, field);
      return;
    }
    let prefix = 'Field';
    if (field.type === 'default') {
      prefix = 'Form';
    }
    field.id = this._formFieldRegistry._ids.nextPrefixed(`${prefix}_`, field);
  }
  _ensureKey(field) {
    if (!field.key) {
      field.key = this._getUniqueKeyPath(field);
    }
  }
  _enforceDefaultPath(field) {
    if (!field.path) {
      field.path = this._getUniqueKeyPath(field);
    }
  }
  _getUniqueKeyPath(field) {
    let random;
    const parent = this._formFieldRegistry.get(field._parent);

    // ensure key uniqueness at level
    do {
      random = Math.random().toString(36).substring(7);
    } while (parent && parent.components.some(child => child.key === random));
    return `${field.type}_${random}`;
  }
}
FieldFactory.$inject = ['formFieldRegistry', 'pathRegistry', 'formFields'];

/**
 * The PathRegistry class manages a hierarchical structure of paths associated with form fields.
 * It enables claiming, unclaiming, and validating paths within this structure.
 *
 * Example Tree Structure:
 *
 *   [
 *     {
 *       segment: 'root',
 *       claimCount: 1,
 *       children: [
 *         {
 *           segment: 'child1',
 *           claimCount: 2,
 *           children: null  // A leaf node (closed path)
 *         },
 *         {
 *           segment: 'child2',
 *           claimCount: 1,
 *           children: [
 *             {
 *               segment: 'subChild1',
 *               claimCount: 1,
 *               children: []  // An open node (open path)
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 */
class PathRegistry {
  constructor(formFieldRegistry, formFields, injector) {
    this._formFieldRegistry = formFieldRegistry;
    this._formFields = formFields;
    this._injector = injector;
    this._dataPaths = [];
  }
  canClaimPath(path, options = {}) {
    const {
      isClosed = false,
      isRepeatable = false,
      skipAncestryCheck = false,
      claimerId = null,
      knownAncestorIds = []
    } = options;
    let node = {
      children: this._dataPaths
    };

    // (1) if we reach a leaf node, we cannot claim it, if we reach an open node, we can
    // if we reach a repeatable node, we need to ensure that the claimer is (or will be) an ancestor of the repeater
    for (const segment of path) {
      node = _getNextSegment(node, segment);
      if (!node) {
        return true;
      }
      if (node.isRepeatable && !skipAncestryCheck) {
        if (!(claimerId || knownAncestorIds.length)) {
          throw new Error('cannot claim a path that contains a repeater without specifying a claimerId or knownAncestorIds');
        }
        const isValidRepeatClaim = knownAncestorIds.includes(node.repeaterId) || claimerId && getAncestryList(claimerId, this._formFieldRegistry).includes(node.repeaterId);
        if (!isValidRepeatClaim) {
          return false;
        }
      }
      if (node.children === null) {
        return false;
      }
    }

    // (2) if the path lands in the middle of the tree, we can only claim an open, non-repeatable path
    return !(isClosed || isRepeatable);
  }
  claimPath(path, options = {}) {
    const {
      isClosed = false,
      isRepeatable = false,
      claimerId = null,
      knownAncestorIds = []
    } = options;
    if (!this.canClaimPath(path, {
      isClosed,
      isRepeatable,
      claimerId,
      knownAncestorIds
    })) {
      throw new Error(`cannot claim path '${path.join('.')}'`);
    }
    let node = {
      children: this._dataPaths
    };
    for (const segment of path) {
      let child = _getNextSegment(node, segment);
      if (!child) {
        child = {
          segment,
          claimCount: 1,
          children: []
        };
        node.children.push(child);
      } else {
        child.claimCount++;
      }
      node = child;
    }
    if (isClosed) {
      node.children = null;
    }

    // add some additional info when we make a repeatable path claim
    if (isRepeatable) {
      node.isRepeatable = true;
      node.repeaterId = claimerId;
    }
  }
  unclaimPath(path) {
    // verification Pass
    let node = {
      children: this._dataPaths
    };
    for (const segment of path) {
      const child = _getNextSegment(node, segment);
      if (!child) {
        throw new Error(`no open path found for '${path.join('.')}'`);
      }
      node = child;
    }

    // mutation Pass
    node = {
      children: this._dataPaths
    };
    for (const segment of path) {
      const child = _getNextSegment(node, segment);
      child.claimCount--;
      if (child.claimCount === 0) {
        node.children.splice(node.children.indexOf(child), 1);
        break; // Abort early if claimCount reaches zero
      }

      node = child;
    }
  }

  /**
   * Applies a function (fn) recursively on a given field and its children.
   *
   * - `field`: Starting field object.
   * - `fn`: Function to apply.
   * - `context`: Optional object for passing data between calls.
   *
   * Stops early if `fn` returns `false`. Useful for traversing the form field tree.
   *
   * @returns {boolean} Success status based on function execution.
   */
  executeRecursivelyOnFields(field, fn, context = {}) {
    let result = true;
    const formFieldConfig = this._formFields.get(field.type).config;
    if (formFieldConfig.keyed) {
      const callResult = fn({
        field,
        isClosed: true,
        isRepeatable: false,
        context
      });
      return result && callResult;
    } else if (formFieldConfig.pathed) {
      const callResult = fn({
        field,
        isClosed: false,
        isRepeatable: formFieldConfig.repeatable,
        context
      });
      result = result && callResult;
    }

    // stop executing if false is specifically returned or if preventing recursion
    if (result === false || context.preventRecursion) {
      return result;
    }
    if (Array.isArray(field.components)) {
      for (const child of field.components) {
        const callResult = this.executeRecursivelyOnFields(child, fn, clone(context));
        result = result && callResult;

        // stop executing if false is specifically returned
        if (result === false) {
          return result;
        }
      }
    }
    return result;
  }

  /**
   * Generates an array representing the binding path to an underlying data object for a form field.
   *
   * @param {Object} field - The field object with properties: `key`, `path`, `id`, and optionally `_parent`.
   * @param {Object} [options={}] - Configuration options.
   * @param {Object} [options.replacements={}] - A map of field IDs to alternative path arrays.
   * @param {Object} [options.indexes=null] - A map of parent IDs to the index of the field within said parent, leave null to get an unindexed path.
   * @param {Object} [options.cutoffNode] - The ID of the parent field at which to stop generating the path.
   *
   * @returns {(Array<string>|undefined)} An array of strings representing the binding path, or undefined if not determinable.
   */
  getValuePath(field, options = {}) {
    const {
      replacements = {},
      indexes = null,
      cutoffNode = null
    } = options;
    let localValuePath = [];
    const hasReplacement = Object.prototype.hasOwnProperty.call(replacements, field.id);
    const formFieldConfig = this._formFields.get(field.type).config;

    // uses path overrides instead of true path to calculate a potential value path
    if (hasReplacement) {
      const replacement = replacements[field.id];
      if (replacement === null || replacement === undefined || replacement === '') {
        localValuePath = [];
      } else if (typeof replacement === 'string') {
        localValuePath = replacement.split('.');
      } else if (Array.isArray(replacement)) {
        localValuePath = replacement;
      } else {
        throw new Error(`replacements for field ${field.id} must be a string, array or null/undefined`);
      }
    } else if (formFieldConfig.keyed) {
      localValuePath = field.key.split('.');
    } else if (formFieldConfig.pathed && field.path) {
      localValuePath = field.path.split('.');
    }

    // add potential indexes of repeated fields
    if (indexes) {
      localValuePath = this._addIndexes(localValuePath, field, indexes);
    }

    // if parent exists and isn't cutoff node, add parent's value path
    if (field._parent && field._parent !== cutoffNode) {
      const parent = this._formFieldRegistry.get(field._parent);
      return [...(this.getValuePath(parent, options) || []), ...localValuePath];
    }
    return localValuePath;
  }
  clear() {
    this._dataPaths = [];
  }
  _addIndexes(localValuePath, field, indexes) {
    const repeatRenderManager = this._injector.get('repeatRenderManager', false);
    if (repeatRenderManager && repeatRenderManager.isFieldRepeating(field._parent)) {
      return [indexes[field._parent], ...localValuePath];
    }
    return localValuePath;
  }
}
const _getNextSegment = (node, segment) => {
  if (isArray(node.children)) {
    return node.children.find(node => node.segment === segment) || null;
  }
  return null;
};
PathRegistry.$inject = ['formFieldRegistry', 'formFields', 'injector'];

/**
 * @typedef { { id: String, components: Array<String> } } FormRow
 * @typedef { { formFieldId: String, rows: Array<FormRow> } } FormRows
 */

/**
 * Maintains the Form layout in a given structure, for example
 *
 *  [
 *    {
 *      formFieldId: 'FormField_1',
 *      rows: [
 *        { id: 'Row_1', components: [ 'Text_1', 'Textdield_1', ... ]  }
 *      ]
 *    }
 *  ]
 *
 */
class FormLayouter {
  constructor(eventBus) {
    /** @type Array<FormRows>  */
    this._rows = [];
    this._ids = new Ids([32, 36, 1]);
    this._eventBus = eventBus;
  }

  /**
   * @param {FormRow} row
   */
  addRow(formFieldId, row) {
    let rowsPerComponent = this._rows.find(r => r.formFieldId === formFieldId);
    if (!rowsPerComponent) {
      rowsPerComponent = {
        formFieldId,
        rows: []
      };
      this._rows.push(rowsPerComponent);
    }
    rowsPerComponent.rows.push(row);
  }

  /**
   * @param {String} id
   * @returns {FormRow}
   */
  getRow(id) {
    const rows = allRows(this._rows);
    return rows.find(r => r.id === id);
  }

  /**
   * @param {any} formField
   * @returns {FormRow}
   */
  getRowForField(formField) {
    return allRows(this._rows).find(r => {
      const {
        components
      } = r;
      return components.includes(formField.id);
    });
  }

  /**
   * @param {String} formFieldId
   * @returns { Array<FormRow> }
   */
  getRows(formFieldId) {
    const rowsForField = this._rows.find(r => formFieldId === r.formFieldId);
    if (!rowsForField) {
      return [];
    }
    return rowsForField.rows;
  }

  /**
   * @returns {string}
   */
  nextRowId() {
    return this._ids.nextPrefixed('Row_');
  }

  /**
   * @param {any} formField
   */
  calculateLayout(formField) {
    const {
      type,
      components
    } = formField;
    if (!['default', 'group', 'dynamiclist'].includes(type) || !components) {
      return;
    }

    // (1) calculate rows order (by component order)
    const rowsInOrder = groupByRow(components, this._ids);
    Object.entries(rowsInOrder).forEach(([id, components]) => {
      // (2) add fields to rows
      this.addRow(formField.id, {
        id: id,
        components: components.map(c => c.id)
      });
    });

    // (3) traverse through nested components
    components.forEach(field => this.calculateLayout(field));

    // (4) fire event to notify interested parties
    this._eventBus.fire('form.layoutCalculated', {
      rows: this._rows
    });
  }
  clear() {
    this._rows = [];
    this._ids.clear();

    // fire event to notify interested parties
    this._eventBus.fire('form.layoutCleared');
  }
}
FormLayouter.$inject = ['eventBus'];

// helpers //////

function groupByRow(components, ids) {
  return groupBy(components, c => {
    // mitigate missing row by creating new (handle legacy)
    const {
      layout
    } = c;
    if (!layout || !layout.row) {
      return ids.nextPrefixed('Row_');
    }
    return layout.row;
  });
}

/**
 * @param {Array<FormRows>} formRows
 * @returns {Array<FormRow>}
 */
function allRows(formRows) {
  return formRows.map(r => r.rows).flat();
}

class FormFieldRegistry {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._formFields = {};
    eventBus.on('form.clear', () => this.clear());
    this._ids = new Ids([32, 36, 1]);
  }
  add(formField) {
    const {
      id
    } = formField;
    if (this._formFields[id]) {
      throw new Error(`form field with ID ${id} already exists`);
    }
    this._eventBus.fire('formField.add', {
      formField
    });
    this._formFields[id] = formField;
  }
  remove(formField) {
    const {
      id
    } = formField;
    if (!this._formFields[id]) {
      return;
    }
    this._eventBus.fire('formField.remove', {
      formField
    });
    delete this._formFields[id];
  }
  get(id) {
    return this._formFields[id];
  }
  getAll() {
    return Object.values(this._formFields);
  }
  getForm() {
    return this.getAll().find(formField => formField.type === 'default');
  }
  forEach(callback) {
    this.getAll().forEach(formField => callback(formField));
  }
  clear() {
    this._formFields = {};
    this._ids.clear();
  }
}
FormFieldRegistry.$inject = ['eventBus'];

function Renderer(config, eventBus, form, injector) {
  const App = () => {
    const [state, setState] = useState(form._getState());
    const formContext = {
      getService(type, strict = true) {
        return injector.get(type, strict);
      },
      formId: form._id
    };
    eventBus.on('changed', newState => {
      setState(newState);
    });
    const onChange = useCallback(update => form._update(update), []);
    const {
      properties
    } = state;
    const {
      readOnly
    } = properties;
    const onSubmit = useCallback(() => {
      if (!readOnly) {
        form.submit();
      }
    }, [readOnly]);
    const onReset = useCallback(() => form.reset(), []);
    const {
      schema
    } = state;
    if (!schema) {
      return null;
    }
    return jsx(FormContext.Provider, {
      value: formContext,
      children: jsx(FormComponent, {
        onChange: onChange,
        onSubmit: onSubmit,
        onReset: onReset
      })
    });
  };
  const {
    container
  } = config;
  eventBus.on('form.init', () => {
    render(jsx(App, {}), container);
  });
  eventBus.on('form.destroy', () => {
    render(null, container);
  });
}
Renderer.$inject = ['config.renderer', 'eventBus', 'form', 'injector'];

const RenderModule = {
  __init__: ['formFields', 'renderer'],
  formFields: ['type', FormFields],
  renderer: ['type', Renderer]
};

const CoreModule = {
  __depends__: [RenderModule],
  eventBus: ['type', EventBus],
  importer: ['type', Importer],
  fieldFactory: ['type', FieldFactory],
  formFieldRegistry: ['type', FormFieldRegistry],
  pathRegistry: ['type', PathRegistry],
  formLayouter: ['type', FormLayouter],
  validator: ['type', Validator]
};

/**
 * @typedef { import('./types').Injector } Injector
 * @typedef { import('./types').Data } Data
 * @typedef { import('./types').Errors } Errors
 * @typedef { import('./types').Schema } Schema
 * @typedef { import('./types').FormProperties } FormProperties
 * @typedef { import('./types').FormProperty } FormProperty
 * @typedef { import('./types').FormEvent } FormEvent
 * @typedef { import('./types').FormOptions } FormOptions
 *
 * @typedef { {
 *   data: Data,
 *   initialData: Data,
 *   errors: Errors,
 *   properties: FormProperties,
 *   schema: Schema
 * } } State
 *
 * @typedef { (type:FormEvent, priority:number, handler:Function) => void } OnEventWithPriority
 * @typedef { (type:FormEvent, handler:Function) => void } OnEventWithOutPriority
 * @typedef { OnEventWithPriority & OnEventWithOutPriority } OnEventType
 */

const ids = new Ids([32, 36, 1]);

/**
 * The form.
 */
class Form {
  /**
   * @constructor
   * @param {FormOptions} options
   */
  constructor(options = {}) {
    /**
     * @public
     * @type {OnEventType}
     */
    this.on = this._onEvent;

    /**
     * @public
     * @type {String}
     */
    this._id = ids.next();

    /**
     * @private
     * @type {Element}
     */
    this._container = createFormContainer();
    const {
      container,
      injector = this._createInjector(options, this._container),
      properties = {}
    } = options;

    /**
     * @private
     * @type {State}
     */
    this._state = {
      initialData: null,
      data: null,
      properties,
      errors: {},
      schema: null
    };
    this.get = injector.get;
    this.invoke = injector.invoke;
    this.get('eventBus').fire('form.init');
    if (container) {
      this.attachTo(container);
    }
  }
  clear() {
    // clear diagram services (e.g. EventBus)
    this._emit('diagram.clear');

    // clear form services
    this._emit('form.clear');
  }

  /**
   * Destroy the form, removing it from DOM,
   * if attached.
   */
  destroy() {
    // destroy form services
    this.get('eventBus').fire('form.destroy');

    // destroy diagram services (e.g. EventBus)
    this.get('eventBus').fire('diagram.destroy');
    this._detach(false);
  }

  /**
   * Open a form schema with the given initial data.
   *
   * @param {Schema} schema
   * @param {Data} [data]
   *
   * @return Promise<{ warnings: Array<any> }>
   */
  importSchema(schema, data = {}) {
    return new Promise((resolve, reject) => {
      try {
        this.clear();
        const {
          schema: importedSchema,
          warnings
        } = this.get('importer').importSchema(schema);
        const initializedData = this._getInitializedFieldData(clone(data));
        this._setState({
          data: initializedData,
          errors: {},
          schema: importedSchema,
          initialData: clone(initializedData)
        });
        this._emit('import.done', {
          warnings
        });
        return resolve({
          warnings
        });
      } catch (error) {
        this._emit('import.done', {
          error,
          warnings: error.warnings || []
        });
        return reject(error);
      }
    });
  }

  /**
   * Submit the form, triggering all field validations.
   *
   * @returns { { data: Data, errors: Errors } }
   */
  submit() {
    const {
      properties
    } = this._getState();
    if (properties.readOnly || properties.disabled) {
      throw new Error('form is read-only');
    }
    this._emit('presubmit');
    const data = this._getSubmitData();
    const errors = this.validate();
    const result = {
      data,
      errors
    };
    this._emit('submit', result);
    return result;
  }
  reset() {
    this._emit('reset');
    this._setState({
      data: clone(this._state.initialData),
      errors: {}
    });
  }

  /**
   * @returns {Errors}
   */
  validate() {
    const formFields = this.get('formFields'),
      formFieldRegistry = this.get('formFieldRegistry'),
      pathRegistry = this.get('pathRegistry'),
      validator = this.get('validator');
    const {
      data
    } = this._getState();
    const getErrorPath = (field, indexes) => [field.id, ...Object.values(indexes || {})];
    function validateFieldRecursively(errors, field, indexes) {
      const {
        disabled,
        type,
        isRepeating
      } = field;
      const {
        config: fieldConfig
      } = formFields.get(type);

      // (1) Skip disabled fields
      if (disabled) {
        return;
      }

      // (2) Validate the field
      const valuePath = pathRegistry.getValuePath(field, {
        indexes
      });
      const valueData = get(data, valuePath);
      const fieldErrors = validator.validateField(field, valueData);
      if (fieldErrors.length) {
        set(errors, getErrorPath(field, indexes), fieldErrors);
      }

      // (3) Process parents
      if (!Array.isArray(field.components)) {
        return;
      }

      // (4a) Recurse repeatable parents both across the indexes of repetition and the children
      if (fieldConfig.repeatable && isRepeating) {
        if (!Array.isArray(valueData)) {
          return;
        }
        valueData.forEach((_, index) => {
          field.components.forEach(component => {
            validateFieldRecursively(errors, component, {
              ...indexes,
              [field.id]: index
            });
          });
        });
        return;
      }

      // (4b) Recurse non-repeatable parents only across the children
      field.components.forEach(component => validateFieldRecursively(errors, component, indexes));
    }
    const workingErrors = {};
    validateFieldRecursively(workingErrors, formFieldRegistry.getForm());
    const filteredErrors = this._applyConditions(workingErrors, data, {
      getFilterPath: getErrorPath,
      leafNodeDeletionOnly: true
    });
    this._setState({
      errors: filteredErrors
    });
    return filteredErrors;
  }

  /**
   * @param {Element|string} parentNode
   */
  attachTo(parentNode) {
    if (!parentNode) {
      throw new Error('parentNode required');
    }
    this.detach();
    if (isString(parentNode)) {
      parentNode = document.querySelector(parentNode);
    }
    const container = this._container;
    parentNode.appendChild(container);
    this._emit('attach');
  }
  detach() {
    this._detach();
  }

  /**
   * @private
   *
   * @param {boolean} [emit]
   */
  _detach(emit = true) {
    const container = this._container,
      parentNode = container.parentNode;
    if (!parentNode) {
      return;
    }
    if (emit) {
      this._emit('detach');
    }
    parentNode.removeChild(container);
  }

  /**
   * @param {FormProperty} property
   * @param {any} value
   */
  setProperty(property, value) {
    const properties = set(this._getState().properties, [property], value);
    this._setState({
      properties
    });
  }

  /**
   * @param {FormEvent} type
   * @param {Function} handler
   */
  off(type, handler) {
    this.get('eventBus').off(type, handler);
  }

  /**
   * @private
   *
   * @param {FormOptions} options
   * @param {Element} container
   *
   * @returns {Injector}
   */
  _createInjector(options, container) {
    const {
      modules = this._getModules(),
      additionalModules = [],
      ...config
    } = options;
    const enrichedConfig = {
      ...config,
      renderer: {
        container
      }
    };
    return createInjector([{
      config: ['value', enrichedConfig]
    }, {
      form: ['value', this]
    }, CoreModule, ...modules, ...additionalModules]);
  }

  /**
   * @private
   */
  _emit(type, data) {
    this.get('eventBus').fire(type, data);
  }

  /**
   * @internal
   *
   * @param { { add?: boolean, field: any, indexes: object, remove?: number, value?: any } } update
   */
  _update(update) {
    const {
      field,
      indexes,
      value
    } = update;
    const {
      data,
      errors
    } = this._getState();
    const validator = this.get('validator'),
      pathRegistry = this.get('pathRegistry');
    const fieldErrors = validator.validateField(field, value);
    const valuePath = pathRegistry.getValuePath(field, {
      indexes
    });
    set(data, valuePath, value);
    set(errors, [field.id, ...Object.values(indexes || {})], fieldErrors.length ? fieldErrors : undefined);
    this._setState({
      data: clone(data),
      errors: clone(errors)
    });
  }

  /**
   * @internal
   */
  _getState() {
    return this._state;
  }

  /**
   * @internal
   */
  _setState(state) {
    this._state = {
      ...this._state,
      ...state
    };
    this._emit('changed', this._getState());
  }

  /**
  * @internal
  */
  _getModules() {
    return [ExpressionLanguageModule, MarkdownRendererModule, ViewerCommandsModule, RepeatRenderModule];
  }

  /**
   * @internal
   */
  _onEvent(type, priority, handler) {
    this.get('eventBus').on(type, priority, handler);
  }

  /**
   * @internal
   */
  _getSubmitData() {
    const formFieldRegistry = this.get('formFieldRegistry');
    const formFields = this.get('formFields');
    const pathRegistry = this.get('pathRegistry');
    const formData = this._getState().data;
    function collectSubmitDataRecursively(submitData, formField, indexes) {
      const {
        disabled,
        type
      } = formField;
      const {
        config: fieldConfig
      } = formFields.get(type);

      // (1) Process keyed fields
      if (!disabled && fieldConfig.keyed) {
        const valuePath = pathRegistry.getValuePath(formField, {
          indexes
        });
        const value = get(formData, valuePath);
        set(submitData, valuePath, value);
      }

      // (2) Process parents
      if (!Array.isArray(formField.components)) {
        return;
      }

      // (3a) Recurse repeatable parents both across the indexes of repetition and the children
      if (fieldConfig.repeatable && formField.isRepeating) {
        const valueData = get(formData, pathRegistry.getValuePath(formField, {
          indexes
        }));
        if (!Array.isArray(valueData)) {
          return;
        }
        valueData.forEach((_, index) => {
          formField.components.forEach(component => {
            collectSubmitDataRecursively(submitData, component, {
              ...indexes,
              [formField.id]: index
            });
          });
        });
        return;
      }

      // (3b) Recurse non-repeatable parents only across the children
      formField.components.forEach(component => collectSubmitDataRecursively(submitData, component, indexes));
    }
    const workingSubmitData = {};
    collectSubmitDataRecursively(workingSubmitData, formFieldRegistry.getForm(), {});
    return this._applyConditions(workingSubmitData, formData);
  }

  /**
   * @internal
   */
  _applyConditions(toFilter, data, options = {}) {
    const conditionChecker = this.get('conditionChecker');
    return conditionChecker.applyConditions(toFilter, data, options);
  }

  /**
   * @internal
   */
  _getInitializedFieldData(data, options = {}) {
    const formFieldRegistry = this.get('formFieldRegistry');
    const formFields = this.get('formFields');
    const pathRegistry = this.get('pathRegistry');
    function initializeFieldDataRecursively(initializedData, formField, indexes) {
      const {
        defaultValue,
        type,
        isRepeating
      } = formField;
      const {
        config: fieldConfig
      } = formFields.get(type);
      const valuePath = pathRegistry.getValuePath(formField, {
        indexes
      });
      let valueData = get(data, valuePath);

      // (1) Process keyed fields
      if (fieldConfig.keyed) {
        // (a) Retrieve and sanitize data from input
        if (!isUndefined(valueData) && fieldConfig.sanitizeValue) {
          valueData = fieldConfig.sanitizeValue({
            formField,
            data,
            value: valueData
          });
        }

        // (b) Initialize field value in output data
        const initializedFieldValue = !isUndefined(valueData) ? valueData : !isUndefined(defaultValue) ? defaultValue : fieldConfig.emptyValue;
        set(initializedData, valuePath, initializedFieldValue);
      }

      // (2) Process parents
      if (!Array.isArray(formField.components)) {
        return;
      }
      if (fieldConfig.repeatable && isRepeating) {
        // (a) Sanitize repeatable parents data if it is not an array
        if (!valueData || !Array.isArray(valueData)) {
          valueData = new Array(isUndefined(formField.defaultRepetitions) ? 1 : formField.defaultRepetitions).fill().map(_ => ({})) || [];
        }

        // (b) Ensure all elements of the array are objects
        valueData = valueData.map(val => isObject(val) ? val : {});

        // (c) Initialize field value in output data
        set(initializedData, valuePath, valueData);

        // (d) If indexed ahead of time, recurse repeatable simply across the children
        if (!isUndefined(indexes[formField.id])) {
          formField.components.forEach(component => initializeFieldDataRecursively(initializedData, component, {
            ...indexes
          }));
          return;
        }

        // (e1) Recurse repeatable parents both across the indexes of repetition and the children
        valueData.forEach((_, index) => {
          formField.components.forEach(component => initializeFieldDataRecursively(initializedData, component, {
            ...indexes,
            [formField.id]: index
          }));
        });
        return;
      }

      // (e2) Recurse non-repeatable parents only across the children
      formField.components.forEach(component => initializeFieldDataRecursively(initializedData, component, indexes));
    }

    // allows definition of a specific subfield to generate the data for
    const container = options.container || formFieldRegistry.getForm();
    const indexes = options.indexes || {};
    const basePath = pathRegistry.getValuePath(container, {
      indexes
    }) || [];

    // if indexing ahead of time, we must add this index to the data path at the end
    const path = !isUndefined(indexes[container.id]) ? [...basePath, indexes[container.id]] : basePath;
    const workingData = clone(data);
    initializeFieldDataRecursively(workingData, container, indexes);
    return get(workingData, path, {});
  }
}

const schemaVersion = 16;

/**
 * @typedef { import('./types').CreateFormOptions } CreateFormOptions
 */

/**
 * Create a form.
 *
 * @param {CreateFormOptions} options
 *
 * @return {Promise<Form>}
 */
function createForm(options) {
  const {
    data,
    schema,
    ...formOptions
  } = options;
  const form = new Form(formOptions);
  return form.importSchema(schema, data).then(function () {
    return form;
  });
}

export { ALLOW_ATTRIBUTE, Button, Checkbox, Checklist, ConditionChecker, DATETIME_SUBTYPES, DATETIME_SUBTYPES_LABELS, DATETIME_SUBTYPE_PATH, DATE_DISALLOW_PAST_PATH, DATE_LABEL_PATH, Datetime, Default, Description, DynamicList, Errors, ExpressionField, ExpressionLanguageModule, FeelExpressionLanguage, FeelersTemplating, FieldFactory, Form, FormComponent, FormContext, FormField, FormFieldRegistry, FormFields, FormLayouter, FormRenderContext, Group, Html, IFrame, Image, Importer, Label, LocalExpressionContext, MINUTES_IN_DAY, MarkdownRenderer, MarkdownRendererModule, Numberfield, OPTIONS_SOURCES, OPTIONS_SOURCES_DEFAULTS, OPTIONS_SOURCES_LABELS, OPTIONS_SOURCES_PATHS, OPTIONS_SOURCE_DEFAULT, PathRegistry, Radio, RenderModule, RepeatRenderManager, RepeatRenderModule, SANDBOX_ATTRIBUTE, SECURITY_ATTRIBUTES_DEFINITIONS, Select, Separator, Spacer, TIME_INTERVAL_PATH, TIME_LABEL_PATH, TIME_SERIALISINGFORMAT_LABELS, TIME_SERIALISING_FORMATS, TIME_SERIALISING_FORMAT_PATH, TIME_USE24H_PATH, Table, Taglist, Text, Textarea, Textfield, ViewerCommands, ViewerCommandsModule, buildExpressionContext, clone, createForm, createFormContainer, createInjector, escapeHTML, formFields, generateIdForType, generateIndexForType, getAncestryList, getOptionsSource, getSchemaVariables, getScrollContainer, hasEqualValue, iconsByType, isRequired, pathParse, pathsEqual, runRecursively, sanitizeDateTimePickerValue, sanitizeHTML, sanitizeIFrameSource, sanitizeImageSource, sanitizeMultiSelectValue, sanitizeSingleSelectValue, schemaVersion, useExpressionEvaluation, useSingleLineTemplateEvaluation, useTemplateEvaluation, wrapCSSStyles };
//# sourceMappingURL=index.es.js.map
