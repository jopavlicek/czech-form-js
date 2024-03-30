'use strict';

var Ids = require('ids');
var formJsViewer = require('@bpmn-io/form-js-viewer');
var minDash = require('min-dash');
var classnames = require('classnames');
var jsxRuntime = require('preact/jsx-runtime');
var hooks = require('preact/hooks');
var preact = require('preact');
var React = require('preact/compat');
var dragula = require('@bpmn-io/draggle');
var minDom = require('min-dom');
var arrayMove = require('array-move');
var feelers = require('feelers');
var FeelEditor = require('@bpmn-io/feel-editor');
var view = require('@codemirror/view');
var focusTrap = require('focus-trap');
var Big = require('big.js');

function _interopNamespaceDefault(e) {
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var React__namespace = /*#__PURE__*/_interopNamespaceDefault(React);
var focusTrap__namespace = /*#__PURE__*/_interopNamespaceDefault(focusTrap);

var FN_REF = '__fn';
var DEFAULT_PRIORITY$3 = 1000;
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
  events = minDash.isArray(events) ? events : [events];
  if (minDash.isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY$3;
  }
  if (!minDash.isNumber(priority)) {
    throw new Error('priority must be a number');
  }
  var actualCallback = callback;
  if (that) {
    actualCallback = minDash.bind(callback, that);

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
  if (minDash.isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY$3;
  }
  if (!minDash.isNumber(priority)) {
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
  events = minDash.isArray(events) ? events : [events];
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
  minDash.assign(this, data || {});
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

/**
 * A factory to create a configurable debouncer.
 *
 * @param {number|boolean} [config=true]
 */
function DebounceFactory(config = true) {
  const timeout = typeof config === 'number' ? config : config ? 300 : 0;
  if (timeout) {
    return fn => minDash.debounce(fn, timeout);
  } else {
    return fn => fn;
  }
}
DebounceFactory.$inject = ['config.debounce'];

class FormFieldRegistry extends formJsViewer.FormFieldRegistry {
  /**
   * Updates a form fields id.
   *
   * @param {Object} formField
   * @param {string} newId
   */
  updateId(formField, newId) {
    this._validateId(newId);
    this._eventBus.fire('formField.updateId', {
      formField,
      newId: newId
    });
    this.remove(formField);
    formField.id = newId;
    this.add(formField);

    // TODO(nikku): make this a proper object graph so we
    // do not have to deal with IDs this way...
    if ('components' in formField) {
      for (const component of formField.components) {
        component._parent = newId;
      }
    }
  }

  /**
   * Validate the suitability of the given id and signals a problem
   * with an exception.
   *
   * @param {string} id
   *
   * @throws {Error} if id is empty or already assigned
   */
  _validateId(id) {
    if (!id) {
      throw new Error('formField must have an id');
    }
    if (this.get(id)) {
      throw new Error('formField with id ' + id + ' already added');
    }
  }
}

const MAX_COLUMNS_PER_ROW = 16;
const MAX_COLUMNS = 16;
const MIN_COLUMNS = 2;
const MAX_FIELDS_PER_ROW = 4;
class FormLayoutValidator {
  /**
   * @constructor
   *
   * @param { import('./FormLayouter').FormLayouter } formLayouter
   * @param { import('./FormFieldRegistry').FormFieldRegistry } formFieldRegistry
   */
  constructor(formLayouter, formFieldRegistry) {
    this._formLayouter = formLayouter;
    this._formFieldRegistry = formFieldRegistry;
  }
  validateField(field = {}, columns, row) {
    // allow empty (auto columns)
    if (Number.isInteger(columns)) {
      // allow minimum cols
      if (columns < MIN_COLUMNS) {
        return `Minimální šířka je ${MIN_COLUMNS} sloupců`;
      }

      // allow maximum cols
      if (columns > MAX_COLUMNS) {
        return `Maximální šířka je ${MAX_COLUMNS} sloupců`;
      }
    }
    if (!row) {
      row = this._formLayouter.getRowForField(field);
    }

    // calculate columns with and without updated field
    let sumColumns = parseInt(columns) || 0;
    let sumFields = 1;
    let sumAutoCols = columns ? 0 : 1;
    row.components.forEach(id => {
      if (field.id === id) {
        return;
      }
      const component = this._formFieldRegistry.get(id);
      const cols = (component.layout || {}).columns;
      if (!cols) {
        sumAutoCols++;
      }
      sumColumns += parseInt(cols) || 0;
      sumFields++;
    });

    // do not allow overflows
    if (sumColumns > MAX_COLUMNS_PER_ROW || sumAutoCols > 0 && sumColumns > calculateMaxColumnsWithAuto(sumAutoCols) || columns === MAX_COLUMNS_PER_ROW && sumFields > 1) {
      return `Nová hodnota předahuje maximum ${MAX_COLUMNS_PER_ROW} sloupců na řádek`;
    }
    if (sumFields > MAX_FIELDS_PER_ROW) {
      return `Byl přesažen maximální počet polí na řádek ${MAX_FIELDS_PER_ROW}`;
    }
    return null;
  }
}
FormLayoutValidator.$inject = ['formLayouter', 'formFieldRegistry'];

// helper //////////////////////

// on normal screen sizes, auto columns take minimum 2 columns
function calculateMaxColumnsWithAuto(autoCols) {
  return MAX_COLUMNS_PER_ROW - autoCols * 2;
}

const emptyImage = createEmptyImage();
function editorFormFieldClasses(type, {
  disabled = false
} = {}) {
  if (!type) {
    throw new Error('type required');
  }
  return classnames('fjs-form-field', `fjs-form-field-${type}`, {
    'fjs-disabled': disabled
  });
}

/**
 * Add a dragger that calls back the passed function with
 * { event, delta } on drag.
 *
 * @example
 *
 * function dragMove(event, delta) {
 *   // we are dragging (!!)
 * }
 *
 * domElement.addEventListener('dragstart', dragger(dragMove));
 *
 * @param {Function} fn
 *
 * @return {Function} drag start callback function
 */
function createDragger$1(fn) {
  let self;
  let startX, startY;

  /** drag start */
  function onDragStart(event) {
    self = this;
    startX = event.clientX;
    startY = event.clientY;

    // (1) hide drag preview image
    if (event.dataTransfer) {
      event.dataTransfer.setDragImage(emptyImage, 0, 0);
    }

    // (2) setup drag listeners

    // attach drag + cleanup event
    document.addEventListener('dragover', onDrag);
    document.addEventListener('dragend', onEnd);
    document.addEventListener('drop', preventDefault$1);
  }
  function onDrag(event) {
    const delta = {
      x: event.clientX - startX,
      y: event.clientY - startY
    };

    // call provided fn with event, delta
    return fn.call(self, event, delta);
  }
  function onEnd() {
    document.removeEventListener('dragover', onDrag);
    document.removeEventListener('dragend', onEnd);
    document.removeEventListener('drop', preventDefault$1);
  }
  return onDragStart;
}

/**
 * Throttle function call according UI update cycle.
 *
 * @param  {Function} fn
 *
 * @return {Function} throttled fn
 */
function throttle(fn) {
  let active = false;
  let lastArgs = [];
  let lastThis = undefined;
  return function (...args) {
    lastArgs = args;
    lastThis = this;
    if (active) {
      return;
    }
    active = true;
    fn.apply(lastThis, lastArgs);
    window.requestAnimationFrame(function () {
      lastArgs = lastThis = active = undefined;
    });
  };
}
function preventDefault$1(event) {
  event.preventDefault();
  event.stopPropagation();
}
function createEmptyImage() {
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  return img;
}

function EditorIFrame(props) {
  const {
    field,
    domId
  } = props;
  const {
    label
  } = field;
  const Icon = formJsViewer.iconsByType(field.type);
  return jsxRuntime.jsxs("div", {
    class: editorFormFieldClasses(field.type),
    children: [jsxRuntime.jsx(formJsViewer.Label, {
      id: domId,
      label: label
    }), jsxRuntime.jsx("div", {
      class: "fjs-iframe-placeholder",
      id: domId,
      children: jsxRuntime.jsxs("p", {
        class: "fjs-iframe-placeholder-text",
        children: [jsxRuntime.jsx(Icon, {
          width: "32",
          height: "24",
          viewBox: "0 0 56 56"
        }), "iFrame"]
      })
    })]
  });
}
EditorIFrame.config = formJsViewer.IFrame.config;

const DragAndDropContext = preact.createContext({
  drake: null
});

/**
 * @param {string} type
 * @param {boolean} [strict]
 *
 * @returns {any}
 */
function getService$1(type, strict) {}
const FormEditorContext = preact.createContext({
  getService: getService$1
});

function useService$1(type, strict) {
  const {
    getService
  } = hooks.useContext(FormEditorContext);
  return getService(type, strict);
}

function usePrevious$1(value, defaultValue = null) {
  const ref = hooks.useRef(defaultValue);
  hooks.useEffect(() => ref.current = value, [value]);
  return ref.current;
}

/**
 * @param {Function} fn - function to debounce
 */
function useDebounce(fn) {
  const debounce = useService$1('debounce');
  const callback = hooks.useMemo(() => {
    return debounce(fn);
  }, [debounce, fn]);

  // cleanup async side-effect if callback #flush is provided.
  hooks.useEffect(() => {
    return () => {
      typeof callback.flush === 'function' && callback.flush();
    };
  }, [callback]);
  return callback;
}

var _path$5;
function _extends$5() { _extends$5 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$5.apply(this, arguments); }
var SvgClose = function SvgClose(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$5({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "currentColor"
  }, props), _path$5 || (_path$5 = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "m12 4.7-.7-.7L8 7.3 4.7 4l-.7.7L7.3 8 4 11.3l.7.7L8 8.7l3.3 3.3.7-.7L8.7 8 12 4.7Z",
    clipRule: "evenodd"
  })));
};
var CloseIcon = SvgClose;

var _path$4, _path2$1;
function _extends$4() { _extends$4 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$4.apply(this, arguments); }
var SvgDelete = function SvgDelete(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$4({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none"
  }, props), /*#__PURE__*/React__namespace.createElement("rect", {
    width: 16,
    height: 16,
    x: 0.536,
    fill: "#fff",
    rx: 3,
    style: {
      mixBlendMode: "multiply"
    }
  }), /*#__PURE__*/React__namespace.createElement("path", {
    fill: "#fff",
    d: "M0 0h16v16H0z",
    style: {
      mixBlendMode: "multiply"
    },
    transform: "translate(.536)"
  }), _path$4 || (_path$4 = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "currentcolor",
    d: "M7.536 6h-1v6h1V6Zm3 0h-1v6h1V6Z"
  })), _path2$1 || (_path2$1 = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "currentcolor",
    d: "M2.536 3v1h1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4h1V3h-12Zm2 11V4h8v10h-8Zm6-13h-4v1h4V1Z"
  })));
};
var DeleteIcon$1 = SvgDelete;

var _path$3;
function _extends$3() { _extends$3 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$3.apply(this, arguments); }
var SvgDraggable = function SvgDraggable(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$3({
    xmlns: "http://www.w3.org/2000/svg",
    xmlSpace: "preserve",
    width: 16,
    height: 16,
    fill: "currentcolor",
    viewBox: "0 0 32 32"
  }, props), _path$3 || (_path$3 = /*#__PURE__*/React__namespace.createElement("path", {
    d: "M10 6h4v4h-4zm8 0h4v4h-4zm-8 8h4v4h-4zm8 0h4v4h-4zm-8 8h4v4h-4zm8 0h4v4h-4z"
  })), /*#__PURE__*/React__namespace.createElement("path", {
    d: "M0 0h32v32H0z",
    style: {
      fill: "none"
    }
  }));
};
var DraggableIcon = SvgDraggable;

var _path$2;
function _extends$2() { _extends$2 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$2.apply(this, arguments); }
var SvgSearch = function SvgSearch(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$2({
    xmlns: "http://www.w3.org/2000/svg",
    width: 15,
    height: 15,
    fill: "none"
  }, props), _path$2 || (_path$2 = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "currentColor",
    d: "m14.5 13.793-3.776-3.776a5.508 5.508 0 1 0-.707.707l3.776 3.776.707-.707ZM2 6.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z"
  })));
};
var SearchIcon = SvgSearch;

var _path$1, _rect, _mask, _path2, _path3, _path4, _path5, _path6;
function _extends$1() { _extends$1 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$1.apply(this, arguments); }
var SvgEmptyForm = function SvgEmptyForm(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$1({
    xmlns: "http://www.w3.org/2000/svg",
    width: 126,
    height: 96,
    fill: "none"
  }, props), _path$1 || (_path$1 = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "#FF832B",
    fillRule: "evenodd",
    d: "M70 78v8a3 3 0 0 1-3 3h-8v-5h6v-6h5Zm0-16h-5V46h5v16Zm0-32h-5v-6h-6v-5h8a3 3 0 0 1 3 3v8ZM43 19v5H27v-5h16Zm-32 0v5H5v6H0v-8a3 3 0 0 1 3-3h8ZM0 46h5v16H0V46Zm0 32h5v6h6v5H3a3 3 0 0 1-3-3v-8Zm27 11v-5h16v5H27Z",
    clipRule: "evenodd"
  })), _rect || (_rect = /*#__PURE__*/React__namespace.createElement("rect", {
    width: 70,
    height: 70,
    fill: "#E5E5E5",
    rx: 3,
    transform: "matrix(-1 0 0 1 94 0)"
  })), _mask || (_mask = /*#__PURE__*/React__namespace.createElement("mask", {
    id: "EmptyForm_svg__a",
    fill: "#fff"
  }, /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M87.085 88.684 75.43 45.185l43.499 11.656-11.044 8.072 8.557 8.556-12.728 12.728-8.557-8.556-8.072 11.043Z",
    clipRule: "evenodd"
  }))), _path2 || (_path2 = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "#393939",
    fillRule: "evenodd",
    d: "M87.085 88.684 75.43 45.185l43.499 11.656-11.044 8.072 8.557 8.556-12.728 12.728-8.557-8.556-8.072 11.043Z",
    clipRule: "evenodd"
  })), _path3 || (_path3 = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "#393939",
    d: "M75.43 45.185 70.6 46.48l-2.241-8.365 8.365 2.242-1.294 4.83Zm11.655 43.499 4.037 2.95-6.163 8.432-2.704-10.088 4.83-1.294Zm31.844-31.843 1.294-4.83 10.088 2.703-8.432 6.163-2.95-4.036Zm-11.044 8.072-3.535 3.535-4.128-4.127 4.713-3.445 2.95 4.037Zm8.557 8.556 3.535-3.535 3.536 3.535-3.536 3.536-3.535-3.536Zm-12.728 12.728 3.536 3.536-3.536 3.535-3.536-3.535 3.536-3.536Zm-8.557-8.556-4.036-2.951 3.444-4.713 4.128 4.128-3.536 3.535ZM80.26 43.89 91.915 87.39l-9.66 2.588L70.6 46.48l9.66-2.588Zm37.375 17.78L74.136 50.014l2.588-9.66 43.499 11.656-2.589 9.66Zm-12.699-.795 11.043-8.072 5.901 8.073-11.043 8.072-5.901-8.073Zm7.971 16.129-8.556-8.557 7.071-7.07 8.556 8.556-7.071 7.07Zm-12.728 5.657 12.728-12.728 7.071 7.07-12.727 12.729-7.072-7.071Zm-1.485-8.557 8.557 8.557-7.072 7.07-8.556-8.556 7.07-7.071ZM83.049 85.733 91.12 74.69l8.073 5.901-8.072 11.044-8.073-5.902Z",
    mask: "url(#EmptyForm_svg__a)"
  })), _path4 || (_path4 = /*#__PURE__*/React__namespace.createElement("path", {
    stroke: "#000",
    strokeLinecap: "round",
    strokeWidth: 3,
    d: "m69.431 39.163-9.192-9.192"
  })), _path5 || (_path5 = /*#__PURE__*/React__namespace.createElement("path", {
    stroke: "#000",
    strokeLinecap: "round",
    strokeWidth: 3,
    d: "M1.5-1.5h8",
    transform: "matrix(-1 0 0 1 68.213 50.123)"
  })), _path6 || (_path6 = /*#__PURE__*/React__namespace.createElement("path", {
    stroke: "#000",
    strokeLinecap: "round",
    strokeWidth: 3,
    d: "M78.969 36.367v-8"
  })));
};
var EmptyFormIcon = SvgEmptyForm;

function EditorText(props) {
  const {
    type,
    text = ''
  } = props.field;
  const Icon = formJsViewer.iconsByType('text');
  const templating = useService$1('templating');
  const expressionLanguage = useService$1('expressionLanguage');
  if (!text || !text.trim()) {
    return jsxRuntime.jsx("div", {
      class: editorFormFieldClasses(type),
      children: jsxRuntime.jsxs("div", {
        class: "fjs-form-field-placeholder",
        children: [jsxRuntime.jsx(Icon, {
          viewBox: "0 0 54 54"
        }), "Text view is empty"]
      })
    });
  }
  if (expressionLanguage.isExpression(text)) {
    return jsxRuntime.jsx("div", {
      class: editorFormFieldClasses(type),
      children: jsxRuntime.jsxs("div", {
        class: "fjs-form-field-placeholder",
        children: [jsxRuntime.jsx(Icon, {
          viewBox: "0 0 54 54"
        }), "Text view is populated by an expression"]
      })
    });
  }
  if (templating.isTemplate(text)) {
    return jsxRuntime.jsx("div", {
      class: editorFormFieldClasses(type),
      children: jsxRuntime.jsxs("div", {
        class: "fjs-form-field-placeholder",
        children: [jsxRuntime.jsx(Icon, {
          viewBox: "0 0 54 54"
        }), "Text view is templated"]
      })
    });
  }
  return jsxRuntime.jsx(formJsViewer.Text, {
    ...props,
    disableLinks: true
  });
}
EditorText.config = formJsViewer.Text.config;

function EditorHtml(props) {
  const {
    type,
    content = ''
  } = props.field;
  const Icon = formJsViewer.iconsByType(type);
  const templating = useService$1('templating');
  const expressionLanguage = useService$1('expressionLanguage');
  if (!content || !content.trim()) {
    return jsxRuntime.jsx("div", {
      class: editorFormFieldClasses(type),
      children: jsxRuntime.jsxs("div", {
        class: "fjs-form-field-placeholder",
        children: [jsxRuntime.jsx(Icon, {
          viewBox: "0 0 54 54"
        }), "Html is empty"]
      })
    });
  }
  if (expressionLanguage.isExpression(content)) {
    return jsxRuntime.jsx("div", {
      class: editorFormFieldClasses(type),
      children: jsxRuntime.jsxs("div", {
        class: "fjs-form-field-placeholder",
        children: [jsxRuntime.jsx(Icon, {
          viewBox: "0 0 54 54"
        }), "Html is populated by an expression"]
      })
    });
  }
  if (templating.isTemplate(content)) {
    return jsxRuntime.jsx("div", {
      class: editorFormFieldClasses(type),
      children: jsxRuntime.jsxs("div", {
        class: "fjs-form-field-placeholder",
        children: [jsxRuntime.jsx(Icon, {
          viewBox: "0 0 54 54"
        }), "Html is templated"]
      })
    });
  }
  return jsxRuntime.jsx(formJsViewer.Html, {
    ...props,
    disableLinks: true
  });
}
EditorHtml.config = formJsViewer.Html.config;

function EditorTable(props) {
  const {
    columnsExpression,
    columns,
    id,
    label
  } = props.field;
  const shouldUseMockColumns = typeof columnsExpression === 'string' && columnsExpression.length > 0 || Array.isArray(columns) && columns.length === 0;
  const editorColumns = shouldUseMockColumns ? [{
    key: '1',
    label: 'Column 1'
  }, {
    key: '2',
    label: 'Column 2'
  }, {
    key: '3',
    label: 'Column 3'
  }] : columns;
  const prefixId = `fjs-form-${id}`;
  return jsxRuntime.jsxs("div", {
    class: editorFormFieldClasses('table', {
      disabled: true
    }),
    children: [jsxRuntime.jsx(formJsViewer.Label, {
      id: prefixId,
      label: label
    }), jsxRuntime.jsx("div", {
      class: "fjs-table-middle-container",
      children: jsxRuntime.jsx("div", {
        class: "fjs-table-inner-container",
        children: jsxRuntime.jsxs("table", {
          class: classnames('fjs-table', 'fjs-disabled'),
          id: prefixId,
          children: [jsxRuntime.jsx("thead", {
            class: "fjs-table-head",
            children: jsxRuntime.jsx("tr", {
              class: "fjs-table-tr",
              children: editorColumns.map(({
                key,
                label
              }) => jsxRuntime.jsx("th", {
                class: "fjs-table-th",
                children: label
              }, key))
            })
          }), jsxRuntime.jsx("tbody", {
            class: "fjs-table-body",
            children: jsxRuntime.jsx("tr", {
              class: "fjs-table-tr",
              children: editorColumns.map(({
                key
              }) => jsxRuntime.jsx("td", {
                class: "fjs-table-td",
                children: "Content"
              }, key))
            })
          })]
        })
      })
    })]
  });
}
EditorTable.config = formJsViewer.Table.config;

const type = 'expression';
function EditorExpressionField(props) {
  const {
    field
  } = props;
  const {
    expression = ''
  } = field;
  const Icon = formJsViewer.iconsByType('expression');
  const expressionLanguage = useService$1('expressionLanguage');
  let placeholderContent = 'Expression is empty';
  if (expression.trim() && expressionLanguage.isExpression(expression)) {
    placeholderContent = 'Expression';
  }
  return jsxRuntime.jsx("div", {
    class: editorFormFieldClasses(type),
    children: jsxRuntime.jsxs("div", {
      class: "fjs-form-field-placeholder",
      children: [jsxRuntime.jsx(Icon, {
        viewBox: "0 0 54 54"
      }), placeholderContent]
    })
  });
}
EditorExpressionField.config = {
  ...formJsViewer.ExpressionField.config,
  escapeGridRender: false
};

const editorFormFields = [EditorIFrame, EditorText, EditorHtml, EditorTable, EditorExpressionField];

class EditorFormFields extends formJsViewer.FormFields {
  constructor() {
    super();
    editorFormFields.forEach(formField => {
      this.register(formField.config.type, formField);
    });
  }
}

const ModularSection = props => {
  const {
    rootClass,
    RootElement,
    section,
    children
  } = props;
  const eventBus = useService$1('eventBus');
  const sectionConfig = useService$1(`config.${section}`);
  const [parent, setParent] = hooks.useState(sectionConfig && sectionConfig.parent || null);
  const [shouldRender, setShouldRender] = hooks.useState(true);
  const ParentElement = hooks.useMemo(() => {
    if (parent === null) {
      return null;
    }
    if (typeof parent === 'string') {
      const element = document.querySelector(parent);
      if (!element) {
        throw new Error(`Target root element with selector '${parent}' not found for section '${section}'`);
      }
      return document.querySelector(parent);
    }

    // @ts-ignore
    if (!(parent instanceof Element)) {
      throw new Error(`Target root element for section '${section}' must be a valid selector or DOM element`);
    }
    return parent;
  }, [section, parent]);
  hooks.useEffect(() => {
    const onAttach = ({
      container
    }) => {
      setParent(container);
      setShouldRender(true);
    };
    const onDetach = () => {
      setParent(null);
      setShouldRender(false);
    };
    const onReset = () => {
      setParent(null);
      setShouldRender(true);
    };
    eventBus.on(`${section}.attach`, onAttach);
    eventBus.on(`${section}.detach`, onDetach);
    eventBus.on(`${section}.reset`, onReset);
    eventBus.fire(`${section}.section.rendered`);
    return () => {
      eventBus.off(`${section}.attach`, onAttach);
      eventBus.off(`${section}.detach`, onDetach);
      eventBus.off(`${section}.reset`, onReset);
      eventBus.fire(`${section}.section.destroyed`);
    };
  }, [eventBus, section]);
  hooks.useEffect(() => {
    if (shouldRender) {
      eventBus.fire(`${section}.rendered`, {
        element: ParentElement
      });
      return () => {
        eventBus.fire(`${section}.destroyed`, {
          element: ParentElement
        });
      };
    }
  }, [eventBus, section, shouldRender, ParentElement]);
  const Root = hooks.useCallback(({
    children
  }) => RootElement ? jsxRuntime.jsx(RootElement, {
    children: children
  }) : jsxRuntime.jsx("div", {
    className: rootClass,
    children: children
  }), [rootClass, RootElement]);
  return shouldRender ? parent ? React.createPortal(jsxRuntime.jsx(Root, {
    children: children
  }), ParentElement) : jsxRuntime.jsx(Root, {
    children: children
  }) : null;
};

const FillContext = preact.createContext({
  addFill(uid, props) {
    throw new Error('FillContext.addFill() uninitialized');
  },
  removeFill(uid) {
    throw new Error('FillContext.addFill() uninitialized');
  }
});

const Fill = props => {
  const uid = React.useRef(Symbol('fill_uid'));
  const fillContext = React.useContext(FillContext);
  React.useEffect(() => {
    if (!fillContext) {
      return;
    }
    fillContext.addFill({
      id: uid,
      ...props
    });
    return () => {
      fillContext.removeFill(uid);
    };
  }, [fillContext, props]);
  return null;
};

const SlotContext = preact.createContext({
  fills: []
});

const Slot = props => {
  const {
    name,
    fillRoot = FillFragment,
    groupFn = _groupByGroupName,
    separatorFn = key => null,
    limit
  } = props;
  const {
    fills
  } = hooks.useContext(SlotContext);
  const filtered = hooks.useMemo(() => fills.filter(fill => fill.slot === name), [fills, name]);
  const cropped = hooks.useMemo(() => limit ? filtered.slice(0, limit) : filtered, [filtered, limit]);
  const groups = hooks.useMemo(() => groupFn(cropped), [cropped, groupFn]);
  const fillsAndSeparators = hooks.useMemo(() => {
    return buildFills(groups, fillRoot, separatorFn);
  }, [groups, fillRoot, separatorFn]);
  return fillsAndSeparators;
};

/**
 * Creates a Fragment for a fill.
 *
 * @param {Object} fill Fill to be rendered
 * @returns {Object} Preact Fragment containing fill's children
 */
const FillFragment = fill => jsxRuntime.jsx(preact.Fragment, {
  children: fill.children
}, fill.id);

/**
 * Creates an array of fills, with separators inserted between groups.
 *
 * @param {Array} groups Groups of fills
 * @param {Function} fillRenderer Function to create a fill
 * @param {Function} separatorRenderer Function to create a separator
 * @returns {Array} Array of fills and separators
 */
const buildFills = (groups, fillRenderer, separatorRenderer) => {
  const result = [];
  groups.forEach((array, idx) => {
    if (idx !== 0) {
      const separator = separatorRenderer(`__separator_${idx}`);
      if (separator) {
        result.push(separator);
      }
    }
    array.forEach(fill => {
      result.push(fillRenderer(fill));
    });
  });
  return result;
};

/**
 * Groups fills by group name property.
 */
const _groupByGroupName = fills => {
  const groups = [];
  const groupsById = {};
  fills.forEach(function (fill) {
    const {
      group: groupName = 'z_default'
    } = fill;
    let group = groupsById[groupName];
    if (!group) {
      groupsById[groupName] = group = [];
      groups.push(group);
    }
    group.push(fill);
  });
  groups.forEach(group => group.sort(_comparePriority));
  return Object.keys(groupsById).sort().map(id => groupsById[id]);
};

/**
 * Compares fills by priority.
 */
const _comparePriority = (a, b) => {
  return (b.priority || 0) - (a.priority || 0);
};

const noop = () => {};
const SlotFillRoot = props => {
  const [fills, setFills] = hooks.useState([]);
  const {
    onSetFill = noop,
    onRemoveFill = noop
  } = props;
  const fillContext = hooks.useMemo(() => ({
    addFill: fill => {
      setFills(fills => [...fills.filter(f => f.id !== fill.id), fill]);
      onSetFill(fill);
    },
    removeFill: id => {
      setFills(fills => fills.filter(f => f.id !== id));
      onRemoveFill(id);
    }
  }), [onRemoveFill, onSetFill]);
  const slotContext = hooks.useMemo(() => ({
    fills
  }), [fills]);
  return jsxRuntime.jsx(SlotContext.Provider, {
    value: slotContext,
    children: jsxRuntime.jsx(FillContext.Provider, {
      /* @ts-expect-error */
      value: fillContext,
      children: props.children
    })
  });
};

function PaletteEntry(props) {
  const {
    type,
    label,
    icon,
    iconUrl,
    getPaletteIcon
  } = props;
  const modeling = useService$1('modeling');
  const formEditor = useService$1('formEditor');
  const Icon = getPaletteIcon({
    icon,
    iconUrl,
    label,
    type
  });
  const onKeyDown = event => {
    if (event.code === 'Enter') {
      const {
        fieldType: type
      } = event.target.dataset;
      const {
        schema
      } = formEditor._getState();

      // add new form field to last position
      modeling.addFormField({
        type
      }, schema, schema.components.length);
    }
  };
  return jsxRuntime.jsxs("button", {
    type: "button",
    class: "fjs-palette-field fjs-drag-copy fjs-no-drop",
    "data-field-type": type,
    title: `Vložit komponent "${label}"`,
    onKeyDown: onKeyDown,
    children: [Icon ? jsxRuntime.jsx(Icon, {
      class: "fjs-palette-field-icon",
      width: "36",
      height: "36",
      viewBox: "0 0 54 54"
    }) : null, jsxRuntime.jsx("span", {
      class: "fjs-palette-field-text",
      children: label
    })]
  });
}

// helpers ///////////

// function getIndefiniteArticle(type) {
//   if ([
//     'image'
//   ].includes(type)) {
//     return 'an';
//   }

//   return 'a';
// }

const PALETTE_GROUPS = [{
  label: 'Základní',
  id: 'basic-input'
}, {
  label: 'Výběrové',
  id: 'selection'
}, {
  label: 'Prezentační',
  id: 'presentation'
}, {
  label: 'Kontejnerové',
  id: 'container'
}, {
  label: 'Akční',
  id: 'action'
}];
function Palette(props) {
  const formFields = useService$1('formFields');
  const initialPaletteEntries = hooks.useRef(collectPaletteEntries(formFields));
  const [paletteEntries, setPaletteEntries] = hooks.useState(initialPaletteEntries.current);
  const [searchTerm, setSearchTerm] = hooks.useState('');
  const inputRef = hooks.useRef();
  const groups = groupEntries(paletteEntries);
  const simplifyString = hooks.useCallback(str => {
    return str.toLowerCase().replace(/\s+/g, '');
  }, []);
  const filter = hooks.useCallback(entry => {
    const simplifiedSearchTerm = simplifyString(searchTerm);
    if (!simplifiedSearchTerm) {
      return true;
    }
    const simplifiedEntryLabel = simplifyString(entry.label);
    const simplifiedEntryType = simplifyString(entry.type);
    return simplifiedEntryLabel.includes(simplifiedSearchTerm) || simplifiedEntryType.includes(simplifiedSearchTerm);
  }, [searchTerm, simplifyString]);

  // filter entries on search change
  hooks.useEffect(() => {
    const entries = initialPaletteEntries.current.filter(filter);
    setPaletteEntries(entries);
  }, [filter, searchTerm]);
  const handleInput = hooks.useCallback(event => {
    setSearchTerm(() => event.target.value);
  }, [setSearchTerm]);
  const handleClear = hooks.useCallback(event => {
    setSearchTerm('');
    inputRef.current.focus();
  }, [inputRef, setSearchTerm]);
  return jsxRuntime.jsxs("div", {
    class: "fjs-palette",
    children: [jsxRuntime.jsx("div", {
      class: "fjs-palette-header",
      title: "Komponenty",
      children: "Komponenty"
    }), jsxRuntime.jsxs("div", {
      class: "fjs-palette-search-container",
      children: [jsxRuntime.jsx("span", {
        class: "fjs-palette-search-icon",
        children: jsxRuntime.jsx(SearchIcon, {})
      }), jsxRuntime.jsx("input", {
        class: "fjs-palette-search",
        ref: inputRef,
        type: "text",
        placeholder: "Hledat komponenty",
        value: searchTerm,
        onInput: handleInput
      }), searchTerm && jsxRuntime.jsx("button", {
        type: "button",
        title: "Clear content",
        class: "fjs-palette-search-clear",
        onClick: handleClear,
        children: jsxRuntime.jsx(CloseIcon, {})
      })]
    }), jsxRuntime.jsxs("div", {
      class: "fjs-palette-entries",
      children: [groups.map(({
        label,
        entries,
        id
      }) => jsxRuntime.jsxs("div", {
        class: "fjs-palette-group",
        "data-group-id": id,
        children: [jsxRuntime.jsx("span", {
          class: "fjs-palette-group-title",
          children: label
        }), jsxRuntime.jsx("div", {
          class: "fjs-palette-fields fjs-drag-container fjs-no-drop",
          children: entries.map(entry => {
            return jsxRuntime.jsx(PaletteEntry, {
              getPaletteIcon: getPaletteIcon,
              ...entry
            });
          })
        })]
      })), groups.length == 0 && jsxRuntime.jsx("div", {
        class: "fjs-palette-no-entries",
        children: "Nebyly nalezeny \u017E\xE1dn\xE9 komponenty."
      })]
    }), jsxRuntime.jsx("div", {
      class: "fjs-palette-footer",
      children: jsxRuntime.jsx(Slot, {
        name: "editor-palette__footer",
        fillRoot: FillRoot
      })
    })]
  });
}
const FillRoot = fill => jsxRuntime.jsx("div", {
  className: "fjs-palette-footer-fill",
  children: fill.children
});

// helpers ///////

function groupEntries(entries) {
  const groups = PALETTE_GROUPS.map(group => {
    return {
      ...group,
      entries: []
    };
  });
  const getGroup = id => groups.find(group => id === group.id);
  entries.forEach(entry => {
    const {
      group
    } = entry;
    getGroup(group).entries.push(entry);
  });
  return groups.filter(g => g.entries.length);
}

/**
 * Returns a list of palette entries.
 *
 * @param {FormFields} formFields
 * @returns {Array<PaletteEntry>}
 */
function collectPaletteEntries(formFields) {
  return Object.entries(formFields._formFields).map(([type, formField]) => {
    const {
      config: fieldConfig
    } = formField;
    return {
      label: fieldConfig.label,
      type: type,
      group: fieldConfig.group,
      icon: fieldConfig.icon,
      iconUrl: fieldConfig.iconUrl
    };
  }).filter(({
    type
  }) => type !== 'default');
}

/**
 * There are various options to specify an icon for a palette entry.
 *
 * a) via `iconUrl` property in a form field config
 * b) via `icon` property in a form field config
 * c) via statically defined iconsByType (fallback)
 */
function getPaletteIcon(entry) {
  const {
    icon,
    iconUrl,
    type,
    label
  } = entry;
  let Icon;
  if (iconUrl) {
    Icon = () => jsxRuntime.jsx("img", {
      class: "fjs-field-icon-image",
      width: 36,
      style: {
        margin: 'auto'
      },
      alt: label,
      src: formJsViewer.sanitizeImageSource(iconUrl)
    });
  } else {
    Icon = icon || formJsViewer.iconsByType(type);
  }
  return Icon;
}

const InjectedRendersRoot = () => {
  const renderInjector = useService$1('renderInjector');
  const injectedRenderers = renderInjector.fetchRenderers();
  const injectedProps = hooks.useMemo(() => ({
    useService: useService$1,
    components: {
      Fill,
      Slot
    }
  }), []);
  return jsxRuntime.jsx(preact.Fragment, {
    children: injectedRenderers.map(({
      Renderer
    }) => jsxRuntime.jsx(Renderer, {
      ...injectedProps
    }))
  });
};

const CURSOR_CLS_PATTERN = /^fjs-cursor-.*$/;
function set(mode) {
  const classes = minDom.classes(document.body);
  classes.removeMatching(CURSOR_CLS_PATTERN);
  if (mode) {
    classes.add('fjs-cursor-' + mode);
  }
}
function unset() {
  set(null);
}

const DRAG_CONTAINER_CLS = 'fjs-drag-container';
const DROP_CONTAINER_VERTICAL_CLS = 'fjs-drop-container-vertical';
const DROP_CONTAINER_HORIZONTAL_CLS = 'fjs-drop-container-horizontal';
const DRAG_MOVE_CLS = 'fjs-drag-move';
const DRAG_ROW_MOVE_CLS = 'fjs-drag-row-move';
const DRAG_COPY_CLS = 'fjs-drag-copy';
const DRAG_NO_DROP_CLS = 'fjs-no-drop';
const DRAG_NO_MOVE_CLS = 'fjs-no-move';
const ERROR_DROP_CLS = 'fjs-error-drop';

/**
 * @typedef { { id: String, components: Array<any> } } FormRow
 */

class Dragging {
  /**
   * @constructor
   *
   * @param { import('../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
   * @param { import('../../core/FormLayouter').FormLayouter } formLayouter
   * @param { import('../../core/FormLayoutValidator').FormLayoutValidator } formLayoutValidator
   * @param { import('../../core/EventBus').EventBus } eventBus
   * @param { import('../modeling/Modeling').Modeling } modeling
   * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
   */
  constructor(formFieldRegistry, formLayouter, formLayoutValidator, eventBus, modeling, pathRegistry) {
    this._formFieldRegistry = formFieldRegistry;
    this._formLayouter = formLayouter;
    this._formLayoutValidator = formLayoutValidator;
    this._eventBus = eventBus;
    this._modeling = modeling;
    this._pathRegistry = pathRegistry;
  }

  /**
   * Calculates position in form schema given the dropped place.
   *
   * @param { FormRow } targetRow
   * @param { any } targetFormField
   * @param { HTMLElement } sibling
   * @returns { number }
   */
  getTargetIndex(targetRow, targetFormField, sibling) {
    /** @type HTMLElement */
    const siblingFormFieldNode = sibling && sibling.querySelector('.fjs-element');
    const siblingFormField = siblingFormFieldNode && this._formFieldRegistry.get(siblingFormFieldNode.dataset.id);

    // (1) dropped before existing field => place before
    if (siblingFormField) {
      return getFormFieldIndex$1(targetFormField, siblingFormField);
    }

    // (2) dropped in row => place at the end of row (after last field in row)
    if (targetRow) {
      return getFormFieldIndex$1(targetFormField, this._formFieldRegistry.get(targetRow.components[targetRow.components.length - 1])) + 1;
    }

    // (3) dropped as last item
    return targetFormField.components.length;
  }
  validateDrop(element, target) {
    const formFieldNode = element.querySelector('.fjs-element');
    const targetRow = this._formLayouter.getRow(target.dataset.rowId);
    let columns;
    let formField;
    let targetParentId;
    if (formFieldNode) {
      formField = this._formFieldRegistry.get(formFieldNode.dataset.id);
      columns = (formField.layout || {}).columns;

      // (1) check for row constraints
      if (isRow(target)) {
        targetParentId = getFormParent(target).dataset.id;
        const rowError = this._formLayoutValidator.validateField(formField, columns, targetRow);
        if (rowError) {
          return rowError;
        }
      } else {
        targetParentId = target.dataset.id;
      }

      // (2) check target is a valid parent
      if (!targetParentId) {
        return 'Drop is not a valid target';
      }

      // (3) check  for path collisions
      const targetParentFormField = this._formFieldRegistry.get(targetParentId);
      const currentParentFormField = this._formFieldRegistry.get(formField._parent);
      if (targetParentFormField !== currentParentFormField) {
        const targetParentPath = this._pathRegistry.getValuePath(targetParentFormField);
        const currentParentPath = this._pathRegistry.getValuePath(currentParentFormField);
        if (targetParentPath.join('.') !== currentParentPath.join('.')) {
          const isDropAllowedByPathRegistry = this._pathRegistry.executeRecursivelyOnFields(formField, ({
            field,
            isClosed,
            isRepeatable
          }) => {
            const options = {
              cutoffNode: currentParentFormField.id
            };
            const fieldPath = this._pathRegistry.getValuePath(field, options);
            return this._pathRegistry.canClaimPath([...targetParentPath, ...fieldPath], {
              isClosed,
              isRepeatable,
              knownAncestorIds: formJsViewer.getAncestryList(targetParentId, this._formFieldRegistry)
            });
          });
          if (!isDropAllowedByPathRegistry) {
            return 'Drop not allowed by path registry';
          }
        }
      }
    }
  }
  moveField(element, source, targetRow, targetFormField, targetIndex) {
    const formFieldNode = element.querySelector('.fjs-element');
    const formField = this._formFieldRegistry.get(formFieldNode.dataset.id);
    const sourceParent = getFormParent(source);
    const sourceFormField = this._formFieldRegistry.get(sourceParent.dataset.id);
    const sourceIndex = getFormFieldIndex$1(sourceFormField, formField);
    const sourceRow = this._formLayouter.getRowForField(formField);
    this._modeling.moveFormField(formField, sourceFormField, targetFormField, sourceIndex, targetIndex, sourceRow, targetRow);
  }
  createNewField(element, targetRow, targetFormField, targetIndex) {
    const type = element.dataset.fieldType;
    let attrs = {
      type
    };
    attrs = {
      ...attrs,
      _parent: targetFormField.id,
      layout: {
        row: targetRow ? targetRow.id : this._formLayouter.nextRowId(),
        // enable auto columns
        columns: null
      }
    };
    this._modeling.addFormField(attrs, targetFormField, targetIndex);
  }
  handleRowDrop(el, target, source, sibling) {
    const targetFormField = this._formFieldRegistry.get(target.dataset.id);
    const rowNode = el.querySelector('.fjs-layout-row');
    const row = this._formLayouter.getRow(rowNode.dataset.rowId);

    // move each field in the row before first field of sibling row
    row.components.forEach((id, index) => {
      const formField = this._formFieldRegistry.get(id);
      const sourceParent = getFormParent(source);
      const sourceFormField = this._formFieldRegistry.get(sourceParent.dataset.id);
      const siblingRowNode = sibling && sibling.querySelector('.fjs-layout-row');
      const siblingRow = siblingRowNode && this._formLayouter.getRow(siblingRowNode.dataset.rowId);
      const siblingFormField = sibling && this._formFieldRegistry.get(siblingRow.components[0]);
      const sourceIndex = getFormFieldIndex$1(sourceFormField, formField);
      const targetIndex = (siblingRowNode ? getFormFieldIndex$1(targetFormField, siblingFormField) : targetFormField.components.length) + index;
      this._modeling.moveFormField(formField, sourceFormField, targetFormField, sourceIndex, targetIndex, row, row);
    });
  }
  handleElementDrop(el, target, source, sibling, drake) {
    // (1) detect drop target
    const targetFormField = this._formFieldRegistry.get(getFormParent(target).dataset.id);
    let targetRow;

    // (2.1) dropped in existing row
    if (isRow(target)) {
      targetRow = this._formLayouter.getRow(target.dataset.rowId);
    }

    // (2.2) validate whether drop is allowed
    const validationError = this.validateDrop(el, target);
    if (validationError) {
      return drake.cancel(true);
    }
    drake.remove();

    // (3) detect position to drop field in schema order
    const targetIndex = this.getTargetIndex(targetRow, targetFormField, sibling);

    // (4) create new field or move existing
    if (isPalette(source)) {
      this.createNewField(el, targetRow, targetFormField, targetIndex);
    } else {
      this.moveField(el, source, targetRow, targetFormField, targetIndex);
    }
  }

  /**
   * @param { { container: Array<string>, direction: string, mirrorContainer: string } } options
   */
  createDragulaInstance(options) {
    const {
      container,
      mirrorContainer
    } = options || {};
    let dragulaOptions = {
      direction: function (el, target) {
        if (isRow(target)) {
          return 'horizontal';
        }
        return 'vertical';
      },
      mirrorContainer,
      isContainer(el) {
        return container.some(cls => el.classList.contains(cls));
      },
      moves(el, source, handle) {
        return !handle.classList.contains(DRAG_NO_MOVE_CLS) && (el.classList.contains(DRAG_MOVE_CLS) || el.classList.contains(DRAG_COPY_CLS) || el.classList.contains(DRAG_ROW_MOVE_CLS));
      },
      copy(el) {
        return el.classList.contains(DRAG_COPY_CLS);
      },
      accepts: (el, target) => {
        unsetDropNotAllowed(target);

        // allow dropping rows only between rows
        if (el.classList.contains(DRAG_ROW_MOVE_CLS)) {
          return !target.classList.contains(DROP_CONTAINER_HORIZONTAL_CLS);
        }

        // validate field drop
        const validationError = this.validateDrop(el, target);
        if (validationError) {
          // set error feedback to row
          setDropNotAllowed(target);
        }
        return !target.classList.contains(DRAG_NO_DROP_CLS);
      },
      slideFactorX: 10,
      slideFactorY: 5
    };
    const dragulaInstance = dragula(dragulaOptions);

    // bind life cycle events
    dragulaInstance.on('drag', (element, source) => {
      this.emit('drag.start', {
        element,
        source
      });
    });
    dragulaInstance.on('dragend', element => {
      this.emit('drag.end', {
        element
      });
    });
    dragulaInstance.on('drop', (element, target, source, sibling) => {
      this.emit('drag.drop', {
        element,
        target,
        source,
        sibling
      });
    });
    dragulaInstance.on('over', (element, container, source) => {
      this.emit('drag.hover', {
        element,
        container,
        source
      });
    });
    dragulaInstance.on('out', (element, container, source) => {
      this.emit('drag.out', {
        element,
        container,
        source
      });
    });
    dragulaInstance.on('cancel', (element, container, source) => {
      this.emit('drag.cancel', {
        element,
        container,
        source
      });
    });
    dragulaInstance.on('drop', (el, target, source, sibling) => {
      if (!target) {
        dragulaInstance.remove();
        return;
      }

      // (1) handle row drop
      if (isDragRow(el)) {
        this.handleRowDrop(el, target, source, sibling);
      } else {
        // (2) handle form field drop
        this.handleElementDrop(el, target, source, sibling, dragulaInstance);
      }
    });
    this.emit('dragula.created', dragulaInstance);
    return dragulaInstance;
  }
  emit(event, context) {
    this._eventBus.fire(event, context);
  }
}
Dragging.$inject = ['formFieldRegistry', 'formLayouter', 'formLayoutValidator', 'eventBus', 'modeling', 'pathRegistry'];

// helper //////////

function getFormFieldIndex$1(parent, formField) {
  let fieldFormIndex = parent.components.length;
  parent.components.forEach(({
    id
  }, index) => {
    if (id === formField.id) {
      fieldFormIndex = index;
    }
  });
  return fieldFormIndex;
}
function isRow(node) {
  return node.classList.contains('fjs-layout-row');
}
function isDragRow(node) {
  return node.classList.contains(DRAG_ROW_MOVE_CLS);
}
function isPalette(node) {
  return node.classList.contains('fjs-palette-fields');
}
function getFormParent(node) {
  return node.closest('.fjs-element');
}
function setDropNotAllowed(node) {
  node.classList.add(ERROR_DROP_CLS);
  set('not-allowed');
}
function unsetDropNotAllowed(node) {
  node.classList.remove(ERROR_DROP_CLS);
  set('grabbing');
}

function FieldDragPreview(props) {
  const {
    class: className,
    Icon,
    label
  } = props;
  return jsxRuntime.jsxs("div", {
    class: classnames('fjs-field-preview', className),
    children: [jsxRuntime.jsx(Icon, {
      class: "fjs-field-preview-icon",
      width: "36",
      height: "36",
      viewBox: "0 0 54 54"
    }), jsxRuntime.jsx("span", {
      class: "fjs-field-preview-text",
      children: label
    })]
  });
}

const COLUMNS_REGEX = /^cds--col(-lg)?/;
const ELEMENT_RESIZING_CLS = 'fjs-element-resizing';
const GRID_OFFSET_PX = 16;
function FieldResizer(props) {
  const {
    field,
    position
  } = props;
  const ref = hooks.useRef(null);
  const formLayoutValidator = useService$1('formLayoutValidator');
  const modeling = useService$1('modeling');

  // we can't use state as we need to
  // manipulate this inside dragging events
  const context = hooks.useRef({
    startColumns: 0,
    newColumns: 0
  });
  const onResize = throttle((_, delta) => {
    const {
      x: dx
    } = delta;
    const {
      layout = {}
    } = field;
    const newColumns = calculateNewColumns(ref.current, layout.columns || context.current.startColumns, dx, position);
    const errorMessage = formLayoutValidator.validateField(field, newColumns);
    if (!errorMessage) {
      context.current.newColumns = newColumns;

      // make visual updates to preview change
      const columnNode = ref.current.closest('.fjs-layout-column');
      removeMatching(columnNode, COLUMNS_REGEX);
      columnNode.classList.add(`cds--col-lg-${newColumns}`);
    }
  });
  const onResizeStart = event => {
    const target = getElementNode(field);
    const parent = getParent(target);

    // initialize drag handler
    const onDragStart = createDragger$1(onResize);
    onDragStart(event);

    // mitigate auto columns on the grid that
    // has a offset of 16px (1rem) to both side
    const columnNode = getColumnNode(target);
    const startWidth = columnNode.getBoundingClientRect().width + GRID_OFFSET_PX;
    context.current.startColumns = asColumns(startWidth, parent);
    setResizing(target, position);
  };
  const onResizeEnd = () => {
    const {
      layout = {}
    } = field;
    if (context.current.newColumns) {
      modeling.editFormField(field, 'layout', {
        ...layout,
        columns: context.current.newColumns
      });
    }
    const target = getElementNode(field);
    unsetResizing(target, position);
    context.current.newColumns = null;
  };
  if (field.type === 'default') {
    return null;
  }
  return jsxRuntime.jsx("div", {
    ref: ref,
    class: classnames('fjs-field-resize-handle', 'fjs-field-resize-handle-' + position, DRAG_NO_MOVE_CLS),
    draggable: true,
    onDragStart: onResizeStart,
    onDragEnd: onResizeEnd
  });
}

// helper //////

function asColumns(width, parent) {
  const totalWidth = parent.getBoundingClientRect().width;
  const oneColumn = 1 / 16 * totalWidth;
  return Math.round(width / oneColumn);
}
function calculateNewColumns(node, currentColumns, deltaX, position) {
  const parent = getParent(node);

  // invert delta if we are resizing from the left
  if (position === 'left') {
    deltaX = deltaX * -1;
  }
  const deltaColumns = asColumns(deltaX, parent);
  return currentColumns + deltaColumns;
}
function getParent(node) {
  return node.closest('.fjs-layout-row');
}
function removeMatching(node, regex) {
  return minDom.classes(node).removeMatching(regex);
}
function getColumnNode(node) {
  return node.closest('.fjs-layout-column');
}
function getElementNode(field) {
  return minDom.query('.fjs-element[data-id="' + field.id + '"]');
}
function setResizing(node, position) {
  minDom.classes(node).add(ELEMENT_RESIZING_CLS + '-' + position);
}
function unsetResizing(node, position) {
  minDom.classes(node).remove(ELEMENT_RESIZING_CLS + '-' + position);
}

function ContextPad(props) {
  if (!props.children) {
    return null;
  }
  return jsxRuntime.jsx("div", {
    class: "fjs-context-pad",
    children: props.children
  });
}
function EmptyGroup() {
  return jsxRuntime.jsx("div", {
    class: "fjs-empty-component",
    children: jsxRuntime.jsx("span", {
      class: "fjs-empty-component-text",
      children: "Komponenty p\u0159et\xE1hn\u011Bte zde."
    })
  });
}
function EmptyForm() {
  return jsxRuntime.jsx("div", {
    class: "fjs-empty-editor",
    children: jsxRuntime.jsxs("div", {
      class: "fjs-empty-editor-card",
      children: [jsxRuntime.jsx(EmptyFormIcon, {}), jsxRuntime.jsx("h2", {
        children: "Sestavte sv\u016Fj formul\xE1\u0159"
      }), jsxRuntime.jsx("span", {
        children: "P\u0159et\xE1hn\u011Bte komponenty z postrann\xED nab\xEDdky a za\u010Dn\u011Bt\u011B navrhovat."
      }), jsxRuntime.jsx("span", {
        children: "Pou\u017Eijte n\xE1hledov\xE9 okno pro otestov\xE1n\xED formul\xE1\u0159e."
      })]
    })
  });
}
function Empty(props) {
  if (['group', 'dynamiclist'].includes(props.field.type)) {
    return jsxRuntime.jsx(EmptyGroup, {});
  }
  if (props.field.type === 'default') {
    return jsxRuntime.jsx(EmptyForm, {});
  }
  return null;
}
function Element$1(props) {
  const eventBus = useService$1('eventBus'),
    formFieldRegistry = useService$1('formFieldRegistry'),
    formFields = useService$1('formFields'),
    modeling = useService$1('modeling'),
    selection = useService$1('selection');
  const {
    hoverInfo
  } = hooks.useContext(formJsViewer.FormRenderContext);
  const {
    field
  } = props;
  const {
    id,
    type,
    showOutline
  } = field;
  const ref = hooks.useRef();
  const [hovered, setHovered] = hooks.useState(false);
  hooks.useEffect(() => {
    function scrollIntoView({
      selection
    }) {
      const scrollContainer = formJsViewer.getScrollContainer(ref.current);
      if (!selection || selection.type === 'default' || selection.id !== id || !scrollContainer || !ref.current) {
        return;
      }
      const elementBounds = ref.current.getBoundingClientRect();
      const scrollContainerBounds = scrollContainer.getBoundingClientRect();
      const isElementLarger = elementBounds.height > scrollContainerBounds.height;
      const isNotFullyVisible = elementBounds.bottom > scrollContainerBounds.bottom || elementBounds.top < scrollContainerBounds.top;
      if (isNotFullyVisible && !isElementLarger) {
        ref.current.scrollIntoView({
          behavior: 'auto',
          block: 'nearest'
        });
      }
    }
    eventBus.on('selection.changed', scrollIntoView);
    return () => eventBus.off('selection.changed', scrollIntoView);
  }, [eventBus, id]);
  hooks.useLayoutEffect(() => {
    if (selection.isSelected(field)) {
      ref.current.focus();
    }
  }, [selection, field]);
  function onClick(event) {
    event.stopPropagation();
    selection.toggle(field);

    // properly focus on field
    ref.current.focus();
  }
  const isSelected = selection.isSelected(field);
  const classString = hooks.useMemo(() => {
    const classes = [];
    if (props.class) {
      classes.push(...props.class.split(' '));
    }
    if (isSelected) {
      classes.push('fjs-editor-selected');
    }
    const grouplike = ['group', 'dynamiclist'].includes(type);
    if (grouplike) {
      classes.push(showOutline ? 'fjs-outlined' : 'fjs-dashed-outlined');
    }
    if (hovered) {
      classes.push('fjs-editor-hovered');
    }
    return classes.join(' ');
  }, [hovered, isSelected, props.class, showOutline, type]);
  const onRemove = event => {
    event.stopPropagation();
    const parentField = formFieldRegistry.get(field._parent);
    const index = getFormFieldIndex(parentField, field);
    modeling.removeFormField(field, parentField, index);
  };
  const onKeyPress = event => {
    if (event.key === 'Enter') {
      event.stopPropagation();
      selection.toggle(field);
    }
  };
  return jsxRuntime.jsxs("div", {
    class: classString,
    "data-id": id,
    "data-field-type": type,
    tabIndex: type === 'default' ? -1 : 0,
    onClick: onClick,
    onKeyPress: onKeyPress,
    onMouseOver: e => {
      if (hoverInfo.cleanup) {
        hoverInfo.cleanup();
      }
      setHovered(true);
      hoverInfo.cleanup = () => setHovered(false);
      e.stopPropagation();
    },
    ref: ref,
    children: [jsxRuntime.jsx(DebugColumns, {
      field: field
    }), jsxRuntime.jsx(ContextPad, {
      children: selection.isSelected(field) && field.type !== 'default' ? jsxRuntime.jsx("button", {
        type: "button",
        title: getRemoveButtonTitle(field, formFields),
        class: "fjs-context-pad-item",
        onClick: onRemove,
        children: jsxRuntime.jsx(DeleteIcon$1, {})
      }) : null
    }), props.children, jsxRuntime.jsx(FieldResizer, {
      position: "left",
      field: field
    }), jsxRuntime.jsx(FieldResizer, {
      position: "right",
      field: field
    })]
  });
}
function DebugColumns(props) {
  const {
    field
  } = props;
  const debugColumnsConfig = useService$1('config.debugColumns');
  if (!debugColumnsConfig || field.type == 'default') {
    return null;
  }
  return jsxRuntime.jsx("div", {
    style: "width: fit-content;\r padding: 2px 6px;\r height: 16px;\r background: var(--color-blue-205-100-95);\r display: flex;\r justify-content: center;\r align-items: center;\r position: absolute;\r bottom: -2px;\r z-index: 2;\r font-size: 10px;\r right: 3px;",
    class: "fjs-debug-columns",
    children: (field.layout || {}).columns || 'auto'
  });
}
function Children(props) {
  const {
    field
  } = props;
  const {
    id
  } = field;
  const classes = ['fjs-children', DROP_CONTAINER_VERTICAL_CLS];
  if (props.class) {
    classes.push(...props.class.split(' '));
  }
  return jsxRuntime.jsx("div", {
    class: classes.join(' '),
    "data-id": id,
    children: props.children
  });
}
function Row(props) {
  const {
    row
  } = props;
  const {
    id
  } = row;
  const classes = [DROP_CONTAINER_HORIZONTAL_CLS];
  if (props.class) {
    classes.push(...props.class.split(' '));
  }
  return jsxRuntime.jsxs("div", {
    class: classnames(DRAG_ROW_MOVE_CLS),
    children: [jsxRuntime.jsx("span", {
      class: "fjs-row-dragger",
      children: jsxRuntime.jsx(DraggableIcon, {})
    }), jsxRuntime.jsx("div", {
      class: classes.join(' '),
      style: props.style,
      "data-row-id": id,
      children: props.children
    })]
  });
}
function Column(props) {
  const {
    field
  } = props;
  const classes = [DRAG_MOVE_CLS];
  if (field.type === 'default') {
    return props.children;
  }
  if (props.class) {
    classes.push(...props.class.split(' '));
  }
  return jsxRuntime.jsx("div", {
    "data-field-type": field.type,
    class: classes.join(' '),
    children: props.children
  });
}
function FormEditor$1() {
  const dragging = useService$1('dragging'),
    eventBus = useService$1('eventBus'),
    formEditor = useService$1('formEditor'),
    injector = useService$1('injector'),
    selection = useService$1('selection'),
    propertiesPanel = useService$1('propertiesPanel'),
    propertiesPanelConfig = useService$1('config.propertiesPanel');
  const {
    schema,
    properties
  } = formEditor._getState();
  const {
    ariaLabel
  } = properties;
  const formContainerRef = hooks.useRef(null);
  const propertiesPanelRef = hooks.useRef(null);
  const [, setSelection] = hooks.useState(schema);
  const [hasInitialized, setHasInitialized] = hooks.useState(false);
  hooks.useEffect(() => {
    function handleSelectionChanged(event) {
      setSelection(event.selection || schema);
    }
    eventBus.on('selection.changed', handleSelectionChanged);
    return () => {
      eventBus.off('selection.changed', handleSelectionChanged);
    };
  }, [eventBus, schema]);
  hooks.useEffect(() => {
    setSelection(selection.get() || schema);
  }, [selection, schema]);
  const [drake, setDrake] = hooks.useState(null);
  const dragAndDropContext = {
    drake
  };
  hooks.useEffect(() => {
    let dragulaInstance = dragging.createDragulaInstance({
      container: [DRAG_CONTAINER_CLS, DROP_CONTAINER_VERTICAL_CLS, DROP_CONTAINER_HORIZONTAL_CLS],
      mirrorContainer: formContainerRef.current
    });
    setDrake(dragulaInstance);
    const onDetach = () => {
      if (dragulaInstance) {
        dragulaInstance.destroy();
        eventBus.fire('dragula.destroyed');
      }
    };
    const onAttach = () => {
      onDetach();
      dragulaInstance = dragging.createDragulaInstance({
        container: [DRAG_CONTAINER_CLS, DROP_CONTAINER_VERTICAL_CLS, DROP_CONTAINER_HORIZONTAL_CLS],
        mirrorContainer: formContainerRef.current
      });
      setDrake(dragulaInstance);
    };
    const onCreate = drake => {
      setDrake(drake);
    };
    const onDragStart = () => {
      set('grabbing');
    };
    const onDragEnd = () => {
      unset();
    };
    eventBus.on('attach', onAttach);
    eventBus.on('detach', onDetach);
    eventBus.on('dragula.created', onCreate);
    eventBus.on('drag.start', onDragStart);
    eventBus.on('drag.end', onDragEnd);
    return () => {
      onDetach();
      eventBus.off('attach', onAttach);
      eventBus.off('detach', onDetach);
      eventBus.off('dragula.created', onCreate);
      eventBus.off('drag.start', onDragStart);
      eventBus.off('drag.end', onDragEnd);
    };
  }, [dragging, eventBus]);

  // fire event after render to notify interested parties
  hooks.useEffect(() => {
    if (hasInitialized) {
      return;
    }
    setHasInitialized(true);
    eventBus.fire('rendered');

    // keep deprecated event to ensure backward compatibility
    eventBus.fire('formEditor.rendered');
  }, [eventBus, hasInitialized]);
  const formRenderContext = hooks.useMemo(() => ({
    Children,
    Column,
    Element: Element$1,
    Empty,
    Row,
    hoverInfo: {}
  }), []);
  const formContext = hooks.useMemo(() => ({
    getService(type, strict = true) {
      // TODO(philippfromme): clean up
      if (type === 'form') {
        return {
          _getState() {
            return {
              data: {},
              errors: {},
              properties: {
                ariaLabel,
                disabled: true
              },
              schema
            };
          }
        };
      }
      return injector.get(type, strict);
    },
    formId: formEditor._id
  }), [ariaLabel, formEditor, injector, schema]);
  const onSubmit = hooks.useCallback(() => {}, []);
  const onReset = hooks.useCallback(() => {}, []);

  // attach default properties panel
  const hasDefaultPropertiesPanel = defaultPropertiesPanel(propertiesPanelConfig);
  hooks.useEffect(() => {
    if (hasDefaultPropertiesPanel) {
      propertiesPanel.attachTo(propertiesPanelRef.current);
    }
  }, [propertiesPanelRef, propertiesPanel, hasDefaultPropertiesPanel]);
  return jsxRuntime.jsx("div", {
    class: "fjs-form-editor",
    children: jsxRuntime.jsxs(SlotFillRoot, {
      children: [jsxRuntime.jsxs(DragAndDropContext.Provider, {
        value: dragAndDropContext,
        children: [jsxRuntime.jsx(ModularSection, {
          rootClass: "fjs-palette-container",
          section: "palette",
          children: jsxRuntime.jsx(Palette, {})
        }), jsxRuntime.jsx("div", {
          ref: formContainerRef,
          class: "fjs-form-container",
          children: jsxRuntime.jsx(formJsViewer.FormContext.Provider, {
            value: formContext,
            children: jsxRuntime.jsx(formJsViewer.FormRenderContext.Provider, {
              // @ts-ignore
              value: formRenderContext,
              children: jsxRuntime.jsx(formJsViewer.FormComponent, {
                onSubmit: onSubmit,
                onReset: onReset
              })
            })
          })
        }), jsxRuntime.jsx(CreatePreview, {})]
      }), hasDefaultPropertiesPanel && jsxRuntime.jsx("div", {
        class: "fjs-editor-properties-container",
        ref: propertiesPanelRef
      }), jsxRuntime.jsx(ModularSection, {
        rootClass: "fjs-render-injector-container",
        section: "renderInjector",
        children: jsxRuntime.jsx(InjectedRendersRoot, {})
      })]
    })
  });
}
function getFormFieldIndex(parent, formField) {
  let fieldFormIndex = parent.components.length;
  parent.components.forEach(({
    id
  }, index) => {
    if (id === formField.id) {
      fieldFormIndex = index;
    }
  });
  return fieldFormIndex;
}
function CreatePreview(props) {
  const {
    drake
  } = hooks.useContext(DragAndDropContext);
  const formFields = useService$1('formFields');
  hooks.useEffect(() => {
    if (!drake) {
      return;
    }
    function handleCloned(clone, original, type) {
      const fieldType = clone.dataset.fieldType;

      // (1) field preview
      if (fieldType) {
        const paletteEntry = findPaletteEntry(fieldType, formFields);
        if (!paletteEntry) {
          return;
        }
        const {
          label
        } = paletteEntry;
        const Icon = getPaletteIcon(paletteEntry);
        clone.innerHTML = '';
        clone.class = 'gu-mirror';
        clone.classList.add('fjs-field-preview-container');
        if (original.classList.contains('fjs-palette-field')) {
          // default to auto columns when creating from palette
          clone.classList.add('cds--col');
        }

        // todo(pinussilvestrus): dragula, how to mitigate cursor position
        // https://github.com/bevacqua/dragula/issues/285
        preact.render(jsxRuntime.jsx(FieldDragPreview, {
          label: label,
          Icon: Icon
        }), clone);
      } else {
        // (2) row preview

        // remove elements from copy (context pad, row dragger, ...)
        ['fjs-context-pad', 'fjs-row-dragger', 'fjs-debug-columns'].forEach(cls => {
          const cloneNode = clone.querySelectorAll('.' + cls);
          cloneNode.length && cloneNode.forEach(e => e.remove());
        });

        // mirror grid
        clone.classList.add('cds--grid');
        clone.classList.add('cds--grid--condensed');
      }
    }
    drake.on('cloned', handleCloned);
    return () => drake.off('cloned', handleCloned);
  }, [drake, formFields]);
  return null;
}

// helper //////

function findPaletteEntry(type, formFields) {
  return collectPaletteEntries(formFields).find(entry => entry.type === type);
}
function defaultPropertiesPanel(propertiesPanelConfig) {
  return !(propertiesPanelConfig && propertiesPanelConfig.parent);
}
function getRemoveButtonTitle(formField, formFields) {
  const entry = findPaletteEntry(formField.type, formFields);
  if (!entry) {
    return 'Remove form field';
  }
  return `Remove ${entry.label}`;
}

class Renderer {
  constructor(renderConfig, eventBus, formEditor, injector) {
    const {
      container,
      compact = false
    } = renderConfig;
    const App = () => {
      const [state, setState] = hooks.useState(formEditor._getState());
      const formEditorContext = {
        getService(type, strict = true) {
          return injector.get(type, strict);
        }
      };
      formEditor.on('changed', newState => {
        setState(newState);
      });
      const {
        schema
      } = state;
      if (!schema) {
        return null;
      }
      return jsxRuntime.jsx("div", {
        class: `fjs-container fjs-editor-container ${compact ? 'fjs-editor-compact' : ''}`,
        children: jsxRuntime.jsx(FormEditorContext.Provider, {
          value: formEditorContext,
          children: jsxRuntime.jsx(FormEditor$1, {})
        })
      });
    };
    eventBus.on('form.init', () => {
      preact.render(jsxRuntime.jsx(App, {}), container);
    });
    eventBus.on('form.destroy', () => {
      preact.render(null, container);
    });
  }
}
Renderer.$inject = ['config.renderer', 'eventBus', 'formEditor', 'injector'];

const RenderModule = {
  __init__: ['formFields', 'renderer'],
  formFields: ['type', EditorFormFields],
  renderer: ['type', Renderer]
};

const CoreModule = {
  __depends__: [RenderModule],
  debounce: ['factory', DebounceFactory],
  eventBus: ['type', EventBus],
  importer: ['type', formJsViewer.Importer],
  formFieldRegistry: ['type', FormFieldRegistry],
  pathRegistry: ['type', formJsViewer.PathRegistry],
  formLayouter: ['type', formJsViewer.FormLayouter],
  formLayoutValidator: ['type', FormLayoutValidator],
  fieldFactory: ['type', formJsViewer.FieldFactory]
};

/**
 * @typedef {import('didi').Injector} Injector
 *
 * @typedef {import('../../core/EventBus').default} EventBus
 */

var NOT_REGISTERED_ERROR = 'is not a registered action',
  IS_REGISTERED_ERROR = 'is already registered';

/**
 * An interface that provides access to modeling actions by decoupling
 * the one who requests the action to be triggered and the trigger itself.
 *
 * It's possible to add new actions by registering them with ´registerAction´
 * and likewise unregister existing ones with ´unregisterAction´.
 *
 *
 * ## Life-Cycle and configuration
 *
 * The editor actions will wait for diagram initialization before
 * registering default actions _and_ firing an `editorActions.init` event.
 *
 * Interested parties may listen to the `editorActions.init` event with
 * low priority to check, which actions got registered. Other components
 * may use the event to register their own actions via `registerAction`.
 *
 * @param {EventBus} eventBus
 * @param {Injector} injector
 */
function EditorActions(eventBus, injector) {
  // initialize actions
  this._actions = {};
  var self = this;
  eventBus.on('diagram.init', function () {
    // all diagram modules got loaded; check which ones
    // are available and register the respective default actions
    self._registerDefaultActions(injector);

    // ask interested parties to register available editor
    // actions on diagram initialization
    eventBus.fire('editorActions.init', {
      editorActions: self
    });
  });
}
EditorActions.$inject = ['eventBus', 'injector'];

/**
 * Register default actions.
 *
 * @param {Injector} injector
 */
EditorActions.prototype._registerDefaultActions = function (injector) {
  // (1) retrieve optional components to integrate with

  var commandStack = injector.get('commandStack', false);
  var modeling = injector.get('modeling', false);
  var selection = injector.get('selection', false);
  var zoomScroll = injector.get('zoomScroll', false);
  var copyPaste = injector.get('copyPaste', false);
  var canvas = injector.get('canvas', false);
  var rules = injector.get('rules', false);
  var keyboardMove = injector.get('keyboardMove', false);
  var keyboardMoveSelection = injector.get('keyboardMoveSelection', false);

  // (2) check components and register actions

  if (commandStack) {
    this.register('undo', function () {
      commandStack.undo();
    });
    this.register('redo', function () {
      commandStack.redo();
    });
  }
  if (copyPaste && selection) {
    this.register('copy', function () {
      var selectedElements = selection.get();
      if (selectedElements.length) {
        return copyPaste.copy(selectedElements);
      }
    });
  }
  if (copyPaste) {
    this.register('paste', function () {
      copyPaste.paste();
    });
  }
  if (zoomScroll) {
    this.register('stepZoom', function (opts) {
      zoomScroll.stepZoom(opts.value);
    });
  }
  if (canvas) {
    this.register('zoom', function (opts) {
      canvas.zoom(opts.value);
    });
  }
  if (modeling && selection && rules) {
    this.register('removeSelection', function () {
      var selectedElements = selection.get();
      if (!selectedElements.length) {
        return;
      }
      var allowed = rules.allowed('elements.delete', {
          elements: selectedElements
        }),
        removableElements;
      if (allowed === false) {
        return;
      } else if (minDash.isArray(allowed)) {
        removableElements = allowed;
      } else {
        removableElements = selectedElements;
      }
      if (removableElements.length) {
        modeling.removeElements(removableElements.slice());
      }
    });
  }
  if (keyboardMove) {
    this.register('moveCanvas', function (opts) {
      keyboardMove.moveCanvas(opts);
    });
  }
  if (keyboardMoveSelection) {
    this.register('moveSelection', function (opts) {
      keyboardMoveSelection.moveSelection(opts.direction, opts.accelerated);
    });
  }
};

/**
 * Triggers a registered action
 *
 * @param {string} action
 * @param {Object} opts
 *
 * @return {unknown} Returns what the registered listener returns
 */
EditorActions.prototype.trigger = function (action, opts) {
  if (!this._actions[action]) {
    throw error(action, NOT_REGISTERED_ERROR);
  }
  return this._actions[action](opts);
};

/**
 * Registers a collections of actions.
 * The key of the object will be the name of the action.
 *
 * @example
 *
 * ```javascript
 * var actions = {
 *   spaceTool: function() {
 *     spaceTool.activateSelection();
 *   },
 *   lassoTool: function() {
 *     lassoTool.activateSelection();
 *   }
 * ];
 *
 * editorActions.register(actions);
 *
 * editorActions.isRegistered('spaceTool'); // true
 * ```
 *
 * @param {Object} actions
 */
EditorActions.prototype.register = function (actions, listener) {
  var self = this;
  if (typeof actions === 'string') {
    return this._registerAction(actions, listener);
  }
  minDash.forEach(actions, function (listener, action) {
    self._registerAction(action, listener);
  });
};

/**
 * Registers a listener to an action key
 *
 * @param {string} action
 * @param {Function} listener
 */
EditorActions.prototype._registerAction = function (action, listener) {
  if (this.isRegistered(action)) {
    throw error(action, IS_REGISTERED_ERROR);
  }
  this._actions[action] = listener;
};

/**
 * Unregister an existing action
 *
 * @param {string} action
 */
EditorActions.prototype.unregister = function (action) {
  if (!this.isRegistered(action)) {
    throw error(action, NOT_REGISTERED_ERROR);
  }
  this._actions[action] = undefined;
};

/**
 * Returns the identifiers of all currently registered editor actions
 *
 * @return {string[]}
 */
EditorActions.prototype.getActions = function () {
  return Object.keys(this._actions);
};

/**
 * Checks wether the given action is registered
 *
 * @param {string} action
 *
 * @return {boolean}
 */
EditorActions.prototype.isRegistered = function (action) {
  return !!this._actions[action];
};
function error(action, message) {
  return new Error(action + ' ' + message);
}

/**
 * @type { import('didi').ModuleDeclaration }
 */
var BaseEditorActionsModule = {
  __init__: ['editorActions'],
  editorActions: ['type', EditorActions]
};

class FormEditorActions extends EditorActions {
  constructor(eventBus, injector) {
    super(eventBus, injector);
    eventBus.on('form.init', () => {
      this._registerDefaultActions(injector);
      eventBus.fire('editorActions.init', {
        editorActions: this
      });
    });
  }
  _registerDefaultActions(injector) {
    const commandStack = injector.get('commandStack', false),
      formFieldRegistry = injector.get('formFieldRegistry', false),
      selection = injector.get('selection', false);
    if (commandStack) {
      // @ts-ignore
      this.register('undo', () => {
        commandStack.undo();
      });

      // @ts-ignore
      this.register('redo', () => {
        commandStack.redo();
      });
    }
    if (formFieldRegistry && selection) {
      // @ts-ignore
      this.register('selectFormField', (options = {}) => {
        const {
          id
        } = options;
        if (!id) {
          return;
        }
        const formField = formFieldRegistry.get(id);
        if (formField) {
          selection.set(formField);
        }
      });
    }
  }
}
FormEditorActions.$inject = ['eventBus', 'injector'];

const EditorActionsModule = {
  __depends__: [BaseEditorActionsModule],
  editorActions: ['type', FormEditorActions]
};

class EditorTemplating {
  // same rules as viewer templating
  isTemplate(value) {
    return minDash.isString(value) && (value.startsWith('=') || /{{/.test(value));
  }

  // return the template raw, as we usually just want to display that
  evaluate(template) {
    return template;
  }
}
EditorTemplating.$inject = [];

const EditorExpressionLanguageModule = {
  __init__: ['expressionLanguage', 'templating'],
  expressionLanguage: ['type', formJsViewer.FeelExpressionLanguage],
  templating: ['type', EditorTemplating]
};

var KEYS_COPY = ['c', 'C'];
var KEYS_PASTE = ['v', 'V'];
var KEYS_REDO = ['y', 'Y'];
var KEYS_UNDO = ['z', 'Z'];

/**
 * Returns true if event was triggered with any modifier
 * @param {KeyboardEvent} event
 */
function hasModifier(event) {
  return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
}

/**
 * @param {KeyboardEvent} event
 * @return {boolean}
 */
function isCmd(event) {
  // ensure we don't react to AltGr
  // (mapped to CTRL + ALT)
  if (event.altKey) {
    return false;
  }
  return event.ctrlKey || event.metaKey;
}

/**
 * Checks if key pressed is one of provided keys.
 *
 * @param {string|string[]} keys
 * @param {KeyboardEvent} event
 * @return {boolean}
 */
function isKey(keys, event) {
  keys = minDash.isArray(keys) ? keys : [keys];
  return keys.indexOf(event.key) !== -1 || keys.indexOf(event.code) !== -1;
}

/**
 * @param {KeyboardEvent} event
 */
function isShift(event) {
  return event.shiftKey;
}

/**
 * @param {KeyboardEvent} event
 */
function isCopy(event) {
  return isCmd(event) && isKey(KEYS_COPY, event);
}

/**
 * @param {KeyboardEvent} event
 */
function isPaste(event) {
  return isCmd(event) && isKey(KEYS_PASTE, event);
}

/**
 * @param {KeyboardEvent} event
 */
function isUndo(event) {
  return isCmd(event) && !isShift(event) && isKey(KEYS_UNDO, event);
}

/**
 * @param {KeyboardEvent} event
 */
function isRedo(event) {
  return isCmd(event) && (isKey(KEYS_REDO, event) || isKey(KEYS_UNDO, event) && isShift(event));
}

/**
 * @typedef {import('../../core/EventBus').default} EventBus
 *
 * @typedef {({ keyEvent: KeyboardEvent }) => any} Listener
 */

var KEYDOWN_EVENT = 'keyboard.keydown',
  KEYUP_EVENT = 'keyboard.keyup';
var HANDLE_MODIFIER_ATTRIBUTE = 'input-handle-modified-keys';
var DEFAULT_PRIORITY$2 = 1000;

/**
 * A keyboard abstraction that may be activated and
 * deactivated by users at will, consuming global key events
 * and triggering diagram actions.
 *
 * For keys pressed down, keyboard fires `keyboard.keydown` event.
 * The event context contains one field which is `KeyboardEvent` event.
 *
 * The implementation fires the following key events that allow
 * other components to hook into key handling:
 *
 *  - keyboard.bind
 *  - keyboard.unbind
 *  - keyboard.init
 *  - keyboard.destroy
 *
 * All events contain one field which is node.
 *
 * A default binding for the keyboard may be specified via the
 * `keyboard.bindTo` configuration option.
 *
 * @param {Object} config
 * @param {EventTarget} [config.bindTo]
 * @param {EventBus} eventBus
 */
function Keyboard(config, eventBus) {
  var self = this;
  this._config = config || {};
  this._eventBus = eventBus;
  this._keydownHandler = this._keydownHandler.bind(this);
  this._keyupHandler = this._keyupHandler.bind(this);

  // properly clean dom registrations
  eventBus.on('diagram.destroy', function () {
    self._fire('destroy');
    self.unbind();
  });
  eventBus.on('diagram.init', function () {
    self._fire('init');
  });
  eventBus.on('attach', function () {
    if (config && config.bindTo) {
      self.bind(config.bindTo);
    }
  });
  eventBus.on('detach', function () {
    self.unbind();
  });
}
Keyboard.$inject = ['config.keyboard', 'eventBus'];
Keyboard.prototype._keydownHandler = function (event) {
  this._keyHandler(event, KEYDOWN_EVENT);
};
Keyboard.prototype._keyupHandler = function (event) {
  this._keyHandler(event, KEYUP_EVENT);
};
Keyboard.prototype._keyHandler = function (event, type) {
  var eventBusResult;
  if (this._isEventIgnored(event)) {
    return;
  }
  var context = {
    keyEvent: event
  };
  eventBusResult = this._eventBus.fire(type || KEYDOWN_EVENT, context);
  if (eventBusResult) {
    event.preventDefault();
  }
};
Keyboard.prototype._isEventIgnored = function (event) {
  if (event.defaultPrevented) {
    return true;
  }
  return (isInput(event.target) || isButton(event.target) && isKey([' ', 'Enter'], event)) && this._isModifiedKeyIgnored(event);
};
Keyboard.prototype._isModifiedKeyIgnored = function (event) {
  if (!isCmd(event)) {
    return true;
  }
  var allowedModifiers = this._getAllowedModifiers(event.target);
  return allowedModifiers.indexOf(event.key) === -1;
};
Keyboard.prototype._getAllowedModifiers = function (element) {
  var modifierContainer = minDom.closest(element, '[' + HANDLE_MODIFIER_ATTRIBUTE + ']', true);
  if (!modifierContainer || this._node && !this._node.contains(modifierContainer)) {
    return [];
  }
  return modifierContainer.getAttribute(HANDLE_MODIFIER_ATTRIBUTE).split(',');
};

/**
 * Bind keyboard events to the given DOM node.
 *
 * @param {EventTarget} node
 */
Keyboard.prototype.bind = function (node) {
  // make sure that the keyboard is only bound once to the DOM
  this.unbind();
  this._node = node;

  // bind key events
  minDom.event.bind(node, 'keydown', this._keydownHandler);
  minDom.event.bind(node, 'keyup', this._keyupHandler);
  this._fire('bind');
};

/**
 * @return {EventTarget}
 */
Keyboard.prototype.getBinding = function () {
  return this._node;
};
Keyboard.prototype.unbind = function () {
  var node = this._node;
  if (node) {
    this._fire('unbind');

    // unbind key events
    minDom.event.unbind(node, 'keydown', this._keydownHandler);
    minDom.event.unbind(node, 'keyup', this._keyupHandler);
  }
  this._node = null;
};

/**
 * @param {string} event
 */
Keyboard.prototype._fire = function (event) {
  this._eventBus.fire('keyboard.' + event, {
    node: this._node
  });
};

/**
 * Add a listener function that is notified with `KeyboardEvent` whenever
 * the keyboard is bound and the user presses a key. If no priority is
 * provided, the default value of 1000 is used.
 *
 * @param {number} [priority]
 * @param {Listener} listener
 * @param {string} [type='keyboard.keydown']
 */
Keyboard.prototype.addListener = function (priority, listener, type) {
  if (minDash.isFunction(priority)) {
    type = listener;
    listener = priority;
    priority = DEFAULT_PRIORITY$2;
  }
  this._eventBus.on(type || KEYDOWN_EVENT, priority, listener);
};

/**
 * Remove a listener function.
 *
 * @param {Listener} listener
 * @param {string} [type='keyboard.keydown']
 */
Keyboard.prototype.removeListener = function (listener, type) {
  this._eventBus.off(type || KEYDOWN_EVENT, listener);
};
Keyboard.prototype.hasModifier = hasModifier;
Keyboard.prototype.isCmd = isCmd;
Keyboard.prototype.isShift = isShift;
Keyboard.prototype.isKey = isKey;

// helpers ///////

function isInput(target) {
  return target && (minDom.matches(target, 'input, textarea') || target.contentEditable === 'true');
}
function isButton(target) {
  return target && minDom.matches(target, 'button, input[type=submit], input[type=button], a[href], [aria-role=button]');
}

var LOW_PRIORITY$1 = 500;

/**
 * Adds default keyboard bindings.
 *
 * This does not pull in any features will bind only actions that
 * have previously been registered against the editorActions component.
 *
 * @param {EventBus} eventBus
 * @param {Keyboard} keyboard
 */
function KeyboardBindings(eventBus, keyboard) {
  var self = this;
  eventBus.on('editorActions.init', LOW_PRIORITY$1, function (event) {
    var editorActions = event.editorActions;
    self.registerBindings(keyboard, editorActions);
  });
}
KeyboardBindings.$inject = ['eventBus', 'keyboard'];

/**
 * Register available keyboard bindings.
 *
 * @param {Keyboard} keyboard
 * @param {EditorActions} editorActions
 */
KeyboardBindings.prototype.registerBindings = function (keyboard, editorActions) {
  /**
   * Add keyboard binding if respective editor action
   * is registered.
   *
   * @param {string} action name
   * @param {Function} fn that implements the key binding
   */
  function addListener(action, fn) {
    if (editorActions.isRegistered(action)) {
      keyboard.addListener(fn);
    }
  }

  // undo
  // (CTRL|CMD) + Z
  addListener('undo', function (context) {
    var event = context.keyEvent;
    if (isUndo(event)) {
      editorActions.trigger('undo');
      return true;
    }
  });

  // redo
  // CTRL + Y
  // CMD + SHIFT + Z
  addListener('redo', function (context) {
    var event = context.keyEvent;
    if (isRedo(event)) {
      editorActions.trigger('redo');
      return true;
    }
  });

  // copy
  // CTRL/CMD + C
  addListener('copy', function (context) {
    var event = context.keyEvent;
    if (isCopy(event)) {
      editorActions.trigger('copy');
      return true;
    }
  });

  // paste
  // CTRL/CMD + V
  addListener('paste', function (context) {
    var event = context.keyEvent;
    if (isPaste(event)) {
      editorActions.trigger('paste');
      return true;
    }
  });

  // zoom in one step
  // CTRL/CMD + +
  addListener('stepZoom', function (context) {
    var event = context.keyEvent;

    // quirk: it has to be triggered by `=` as well to work on international keyboard layout
    // cf: https://github.com/bpmn-io/bpmn-js/issues/1362#issuecomment-722989754
    if (isKey(['+', 'Add', '='], event) && isCmd(event)) {
      editorActions.trigger('stepZoom', {
        value: 1
      });
      return true;
    }
  });

  // zoom out one step
  // CTRL + -
  addListener('stepZoom', function (context) {
    var event = context.keyEvent;
    if (isKey(['-', 'Subtract'], event) && isCmd(event)) {
      editorActions.trigger('stepZoom', {
        value: -1
      });
      return true;
    }
  });

  // zoom to the default level
  // CTRL + 0
  addListener('zoom', function (context) {
    var event = context.keyEvent;
    if (isKey('0', event) && isCmd(event)) {
      editorActions.trigger('zoom', {
        value: 1
      });
      return true;
    }
  });

  // delete selected element
  // DEL
  addListener('removeSelection', function (context) {
    var event = context.keyEvent;
    if (isKey(['Backspace', 'Delete', 'Del'], event)) {
      editorActions.trigger('removeSelection');
      return true;
    }
  });
};

/**
 * @type { import('didi').ModuleDeclaration }
 */
var KeyboardModule = {
  __init__: ['keyboard', 'keyboardBindings'],
  keyboard: ['type', Keyboard],
  keyboardBindings: ['type', KeyboardBindings]
};

const LOW_PRIORITY = 500;
class FormEditorKeyboardBindings {
  constructor(eventBus, keyboard) {
    eventBus.on('editorActions.init', LOW_PRIORITY, event => {
      const {
        editorActions
      } = event;
      this.registerBindings(keyboard, editorActions);
    });
  }
  registerBindings(keyboard, editorActions) {
    function addListener(action, fn) {
      if (editorActions.isRegistered(action)) {
        keyboard.addListener(fn);
      }
    }

    // undo
    // (CTRL|CMD) + Z
    addListener('undo', context => {
      const {
        keyEvent
      } = context;
      if (isCmd(keyEvent) && !isShift(keyEvent) && isKey(KEYS_UNDO, keyEvent)) {
        editorActions.trigger('undo');
        return true;
      }
    });

    // redo
    // CTRL + Y
    // CMD + SHIFT + Z
    addListener('redo', context => {
      const {
        keyEvent
      } = context;
      if (isCmd(keyEvent) && (isKey(KEYS_REDO, keyEvent) || isKey(KEYS_UNDO, keyEvent) && isShift(keyEvent))) {
        editorActions.trigger('redo');
        return true;
      }
    });
  }
}
FormEditorKeyboardBindings.$inject = ['eventBus', 'keyboard'];

const FormEditorKeyboardModule = {
  __depends__: [KeyboardModule],
  __init__: ['keyboardBindings'],
  keyboardBindings: ['type', FormEditorKeyboardBindings]
};

const DraggingModule = {
  __init__: ['dragging'],
  dragging: ['type', Dragging]
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
      elements: minDash.uniqueBy('id', dirty.reverse())
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
  elements = minDash.isArray(elements) ? elements : [elements];
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

/**
 * @typedef {import('../core/Types').ElementLike} ElementLike
 * @typedef {import('../core/EventBus').default} EventBus
 * @typedef {import('./CommandStack').CommandContext} CommandContext
 *
 * @typedef {string|string[]} Events
 * @typedef { (context: CommandContext) => ElementLike[] | void } HandlerFunction
 * @typedef { (context: CommandContext) => void } ComposeHandlerFunction
 */

var DEFAULT_PRIORITY$1 = 1000;

/**
 * A utility that can be used to plug into the command execution for
 * extension and/or validation.
 *
 * @class
 * @constructor
 *
 * @example
 *
 * ```javascript
 * import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
 *
 * class CommandLogger extends CommandInterceptor {
 *   constructor(eventBus) {
 *     super(eventBus);
 *
 *   this.preExecute('shape.create', (event) => {
 *     console.log('commandStack.shape-create.preExecute', event);
 *   });
 * }
 * ```
 *
 * @param {EventBus} eventBus
 */
function CommandInterceptor(eventBus) {
  /**
   * @type {EventBus}
   */
  this._eventBus = eventBus;
}
CommandInterceptor.$inject = ['eventBus'];
function unwrapEvent(fn, that) {
  return function (event) {
    return fn.call(that || null, event.context, event.command, event);
  };
}

/**
 * Intercept a command during one of the phases.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {string} [hook] phase to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.on = function (events, hook, priority, handlerFn, unwrap, that) {
  if (minDash.isFunction(hook) || minDash.isNumber(hook)) {
    that = unwrap;
    unwrap = handlerFn;
    handlerFn = priority;
    priority = hook;
    hook = null;
  }
  if (minDash.isFunction(priority)) {
    that = unwrap;
    unwrap = handlerFn;
    handlerFn = priority;
    priority = DEFAULT_PRIORITY$1;
  }
  if (minDash.isObject(unwrap)) {
    that = unwrap;
    unwrap = false;
  }
  if (!minDash.isFunction(handlerFn)) {
    throw new Error('handlerFn must be a function');
  }
  if (!minDash.isArray(events)) {
    events = [events];
  }
  var eventBus = this._eventBus;
  minDash.forEach(events, function (event) {
    // concat commandStack(.event)?(.hook)?
    var fullEvent = ['commandStack', event, hook].filter(function (e) {
      return e;
    }).join('.');
    eventBus.on(fullEvent, priority, unwrap ? unwrapEvent(handlerFn, that) : handlerFn, that);
  });
};

/**
 * Add a <canExecute> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.canExecute = createHook('canExecute');

/**
 * Add a <preExecute> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.preExecute = createHook('preExecute');

/**
 * Add a <preExecuted> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.preExecuted = createHook('preExecuted');

/**
 * Add a <execute> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.execute = createHook('execute');

/**
 * Add a <executed> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.executed = createHook('executed');

/**
 * Add a <postExecute> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.postExecute = createHook('postExecute');

/**
 * Add a <postExecuted> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.postExecuted = createHook('postExecuted');

/**
 * Add a <revert> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.revert = createHook('revert');

/**
 * Add a <reverted> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.reverted = createHook('reverted');

/*
 * Add prototype methods for each phase of command execution (e.g. execute,
 * revert).
 *
 * @param {string} hook
 *
 * @return { (
 *   events?: Events,
 *   priority?: number,
 *   handlerFn: ComposeHandlerFunction|HandlerFunction,
 *   unwrap?: boolean
 * ) => any }
 */
function createHook(hook) {
  /**
   * @this {CommandInterceptor}
   *
   * @param {Events} [events]
   * @param {number} [priority]
   * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
   * @param {boolean} [unwrap]
   * @param {any} [that]
   */
  const hookFn = function (events, priority, handlerFn, unwrap, that) {
    if (minDash.isFunction(events) || minDash.isNumber(events)) {
      that = unwrap;
      unwrap = handlerFn;
      handlerFn = priority;
      priority = events;
      events = null;
    }
    this.on(events, hook, priority, handlerFn, unwrap, that);
  };
  return hookFn;
}

class IdBehavior extends CommandInterceptor {
  constructor(eventBus, modeling) {
    super(eventBus);
    this.preExecute('formField.remove', function (context) {
      const {
        formField
      } = context;
      const {
        id
      } = formField;
      modeling.unclaimId(formField, id);
    }, true);
    this.preExecute('formField.edit', function (context) {
      const {
        formField,
        properties
      } = context;
      if ('id' in properties) {
        modeling.unclaimId(formField, formField.id);
        modeling.claimId(formField, properties.id);
      }
    }, true);
  }
}
IdBehavior.$inject = ['eventBus', 'modeling'];

class KeyBehavior extends CommandInterceptor {
  constructor(eventBus, modeling, formFields) {
    super(eventBus);
    this.preExecute('formField.remove', function (context) {
      const {
        formField
      } = context;
      const {
        key,
        type
      } = formField;
      const {
        config
      } = formFields.get(type);
      if (config.keyed) {
        modeling.unclaimKey(formField, key);
      }
    }, true);
    this.preExecute('formField.edit', function (context) {
      const {
        formField,
        properties
      } = context;
      const {
        key,
        type
      } = formField;
      const {
        config
      } = formFields.get(type);
      if (config.keyed && 'key' in properties) {
        modeling.unclaimKey(formField, key);
        modeling.claimKey(formField, properties.key);
      }
    }, true);
  }
}
KeyBehavior.$inject = ['eventBus', 'modeling', 'formFields'];

class PathBehavior extends CommandInterceptor {
  constructor(eventBus, modeling, formFields) {
    super(eventBus);
    this.preExecute('formField.remove', function (context) {
      const {
        formField
      } = context;
      const {
        path,
        type
      } = formField;
      const {
        config
      } = formFields.get(type);
      if (config.pathed) {
        modeling.unclaimPath(formField, path);
      }
    }, true);
    this.preExecute('formField.edit', function (context) {
      const {
        formField,
        properties
      } = context;
      const {
        path,
        type
      } = formField;
      const {
        config
      } = formFields.get(type);
      if (config.pathed && 'path' in properties) {
        modeling.unclaimPath(formField, path);
        modeling.claimPath(formField, properties.path);
      }
    }, true);
  }
}
PathBehavior.$inject = ['eventBus', 'modeling', 'formFields'];

class ValidateBehavior extends CommandInterceptor {
  constructor(eventBus) {
    super(eventBus);

    /**
     * Remove custom validation if <validationType> is about to be added.
     */
    this.preExecute('formField.edit', function (context) {
      const {
        properties
      } = context;
      const {
        validate = {}
      } = properties;
      if (validate.validationType) {
        const newValidate = {
          ...validate
        };
        delete newValidate.minLength;
        delete newValidate.maxLength;
        delete newValidate.pattern;
        properties['validate'] = newValidate;
      }
    }, true);
  }
}
ValidateBehavior.$inject = ['eventBus'];

class OptionsSourceBehavior extends CommandInterceptor {
  constructor(eventBus) {
    super(eventBus);

    /**
     * Cleanup properties on changing the values source.
     *
     * 1) Remove other sources, e.g. set `values` => remove `valuesKey` and `valuesExpression`
     * 2) Remove default values for all other values sources
     */
    this.preExecute('formField.edit', function (context) {
      const {
        properties
      } = context;
      const newProperties = {};
      if (!isValuesSourceUpdate(properties)) {
        return;
      }

      // clean up value sources that are not to going to be set
      Object.values(formJsViewer.OPTIONS_SOURCES).forEach(source => {
        const path = formJsViewer.OPTIONS_SOURCES_PATHS[source];
        if (minDash.get(properties, path) == undefined) {
          newProperties[formJsViewer.OPTIONS_SOURCES_PATHS[source]] = undefined;
        }
      });

      // clean up default value
      if (minDash.get(properties, formJsViewer.OPTIONS_SOURCES_PATHS[formJsViewer.OPTIONS_SOURCES.EXPRESSION]) !== undefined || minDash.get(properties, formJsViewer.OPTIONS_SOURCES_PATHS[formJsViewer.OPTIONS_SOURCES.INPUT]) !== undefined) {
        newProperties['defaultValue'] = undefined;
      }
      context.properties = {
        ...properties,
        ...newProperties
      };
    }, true);
  }
}
OptionsSourceBehavior.$inject = ['eventBus'];

// helper ///////////////////

function isValuesSourceUpdate(properties) {
  return Object.values(formJsViewer.OPTIONS_SOURCES_PATHS).some(path => {
    return minDash.get(properties, path) !== undefined;
  });
}

const COLUMNS_SOURCE_PROPERTIES = {
  columns: 'columns',
  columnsExpression: 'columnsExpression'
};
class ColumnsSourceBehavior extends CommandInterceptor {
  constructor(eventBus) {
    super(eventBus);
    this.preExecute('formField.edit', function (context) {
      const {
        properties,
        oldProperties
      } = context;
      const isColumnSourceUpdate = Object.values(COLUMNS_SOURCE_PROPERTIES).some(path => {
        return minDash.get(properties, [path]) !== undefined;
      });
      if (!isColumnSourceUpdate) {
        return;
      }
      const columns = minDash.get(properties, [COLUMNS_SOURCE_PROPERTIES.columns]);
      const oldColumns = minDash.get(oldProperties, [COLUMNS_SOURCE_PROPERTIES.columns]);
      const columnsExpression = minDash.get(properties, [COLUMNS_SOURCE_PROPERTIES.columnsExpression]);
      const oldColumnsExpression = minDash.get(oldProperties, [COLUMNS_SOURCE_PROPERTIES.columnsExpression]);
      if (minDash.isArray(columns) && !minDash.isDefined(oldColumns)) {
        context.properties = {
          ...properties,
          columnsExpression: undefined
        };
        return;
      }
      if (minDash.isString(columnsExpression) && !minDash.isString(oldColumnsExpression)) {
        context.properties = {
          ...properties,
          columns: undefined
        };
        return;
      }
    }, true);
  }
}
ColumnsSourceBehavior.$inject = ['eventBus'];

class TableDataSourceBehavior extends CommandInterceptor {
  constructor(eventBus) {
    super(eventBus);
    this.preExecute('formField.add', function (context) {
      const {
        formField
      } = context;
      if (minDash.get(formField, ['type']) !== 'table') {
        return;
      }
      context.formField = {
        ...formField,
        dataSource: `=${formField.id}`
      };
    }, true);
  }
}
TableDataSourceBehavior.$inject = ['eventBus'];

const BehaviorModule = {
  __init__: ['idBehavior', 'keyBehavior', 'pathBehavior', 'validateBehavior', 'optionsSourceBehavior', 'columnsSourceBehavior', 'tableDataSourceBehavior'],
  idBehavior: ['type', IdBehavior],
  keyBehavior: ['type', KeyBehavior],
  pathBehavior: ['type', PathBehavior],
  validateBehavior: ['type', ValidateBehavior],
  optionsSourceBehavior: ['type', OptionsSourceBehavior],
  columnsSourceBehavior: ['type', ColumnsSourceBehavior],
  tableDataSourceBehavior: ['type', TableDataSourceBehavior]
};

function arrayAdd$1(array, index, item) {
  array.splice(index, 0, item);
  return array;
}
function arrayRemove(array, index) {
  array.splice(index, 1);
  return array;
}
function updatePath(formFieldRegistry, formField, index) {
  const parent = formFieldRegistry.get(formField._parent);
  refreshPathsRecursively(formField, [...parent._path, 'components', index]);
  return formField;
}
function refreshPathsRecursively(formField, path) {
  formField._path = path;
  const components = formField.components || [];
  components.forEach((component, index) => {
    refreshPathsRecursively(component, [...path, 'components', index]);
  });
}
function updateRow(formField, rowId) {
  formField.layout = {
    ...(formField.layout || {}),
    row: rowId
  };
  return formField;
}

class FormLayoutUpdater extends CommandInterceptor {
  constructor(eventBus, formLayouter, modeling, formEditor) {
    super(eventBus);
    this._eventBus = eventBus;
    this._formLayouter = formLayouter;
    this._modeling = modeling;
    this._formEditor = formEditor;

    // @ts-ignore
    this.preExecute(['formField.add', 'formField.remove', 'formField.move', 'id.updateClaim'], event => this.updateRowIds(event));

    // we need that as the state got updates
    // on the next tick (not in post execute)
    eventBus.on('changed', context => {
      const {
        schema
      } = context;
      this.updateLayout(schema);
    });
  }
  updateLayout(schema) {
    this._formLayouter.clear();
    this._formLayouter.calculateLayout(formJsViewer.clone(schema));
  }
  updateRowIds(event) {
    const {
      schema
    } = this._formEditor._getState();
    const setRowIds = parent => {
      if (!parent.components || !parent.components.length) {
        return;
      }
      parent.components.forEach(formField => {
        const row = this._formLayouter.getRowForField(formField);
        updateRow(formField, row.id);

        // handle children recursively
        setRowIds(formField);
      });
    };

    // make sure rows are persisted in schema (e.g. for migration case)
    setRowIds(schema);
  }
}
FormLayoutUpdater.$inject = ['eventBus', 'formLayouter', 'modeling', 'formEditor'];

class AddFormFieldHandler {
  /**
   * @constructor
   * @param { import('../../../FormEditor').FormEditor } formEditor
   * @param { import('../../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
   */
  constructor(formEditor, formFieldRegistry) {
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
  }
  execute(context) {
    const {
      formField,
      targetFormField,
      targetIndex
    } = context;
    const {
      schema
    } = this._formEditor._getState();
    const targetPath = [...targetFormField._path, 'components'];
    formField._parent = targetFormField.id;

    // (1) Add new form field
    arrayAdd$1(minDash.get(schema, targetPath), targetIndex, formField);

    // (2) Update internal paths of new form field and its siblings (and their children)
    minDash.get(schema, targetPath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

    // (3) Add new form field to form field registry
    this._formFieldRegistry.add(formField);

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
  revert(context) {
    const {
      formField,
      targetFormField,
      targetIndex
    } = context;
    const {
      schema
    } = this._formEditor._getState();
    const targetPath = [...targetFormField._path, 'components'];

    // (1) Remove new form field
    arrayRemove(minDash.get(schema, targetPath), targetIndex);

    // (2) Update internal paths of new form field and its siblings (and their children)
    minDash.get(schema, targetPath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

    // (3) Remove new form field from form field registry
    this._formFieldRegistry.remove(formField);

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
}
AddFormFieldHandler.$inject = ['formEditor', 'formFieldRegistry'];

class EditFormFieldHandler {
  /**
   * @constructor
   * @param { import('../../../FormEditor').FormEditor } formEditor
   * @param { import('../../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
   */
  constructor(formEditor, formFieldRegistry) {
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
  }
  execute(context) {
    const {
      formField,
      properties
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    const oldProperties = {};
    for (let key in properties) {
      oldProperties[key] = formField[key];
      const property = properties[key];
      if (key === 'id') {
        if (property !== formField.id) {
          this._formFieldRegistry.updateId(formField, property);
        }
      } else {
        formField[key] = property;
      }
    }
    context.oldProperties = oldProperties;

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
    return formField;
  }
  revert(context) {
    const {
      formField,
      oldProperties
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    for (let key in oldProperties) {
      const property = oldProperties[key];
      if (key === 'id') {
        if (property !== formField.id) {
          this._formFieldRegistry.updateId(formField, property);
        }
      } else {
        formField[key] = property;
      }
    }

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
    return formField;
  }
}
EditFormFieldHandler.$inject = ['formEditor', 'formFieldRegistry'];

class MoveFormFieldHandler {
  /**
   * @constructor
   * @param { import('../../../FormEditor').FormEditor } formEditor
   * @param { import('../../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
   * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
   * @param { import('@bpmn-io/form-js-viewer').FormLayouter } formLayouter
   */
  constructor(formEditor, formFieldRegistry, pathRegistry, formLayouter) {
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
    this._pathRegistry = pathRegistry;
    this._formLayouter = formLayouter;
  }
  execute(context) {
    this.moveFormField(context);
  }
  revert(context) {
    let {
      sourceFormField,
      targetFormField,
      sourceIndex,
      targetIndex,
      sourceRow,
      targetRow
    } = context;
    this.moveFormField({
      sourceFormField: targetFormField,
      targetFormField: sourceFormField,
      sourceIndex: targetIndex,
      targetIndex: sourceIndex,
      sourceRow: targetRow,
      targetRow: sourceRow
    }, true);
  }
  moveFormField(context, revert) {
    let {
      sourceFormField,
      targetFormField,
      sourceIndex,
      targetIndex,
      targetRow
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    const sourcePath = [...sourceFormField._path, 'components'];
    if (sourceFormField.id === targetFormField.id) {
      if (revert) {
        if (sourceIndex > targetIndex) {
          sourceIndex--;
        }
      } else {
        if (sourceIndex < targetIndex) {
          targetIndex--;
        }
      }
      const formField = minDash.get(schema, [...sourcePath, sourceIndex]);

      // (1) Add to row or create new one
      updateRow(formField, targetRow ? targetRow.id : this._formLayouter.nextRowId());

      // (2) Move form field
      arrayMove.mutate(minDash.get(schema, sourcePath), sourceIndex, targetIndex);

      // (3) Update internal paths of new form field and its siblings (and their children)
      minDash.get(schema, sourcePath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));
    } else {
      const formField = minDash.get(schema, [...sourcePath, sourceIndex]);

      // (1) Deregister form field (and children) from path registry
      this._pathRegistry.executeRecursivelyOnFields(formField, ({
        field
      }) => {
        this._pathRegistry.unclaimPath(this._pathRegistry.getValuePath(field));
      });
      formField._parent = targetFormField.id;

      // (2) Remove form field
      arrayRemove(minDash.get(schema, sourcePath), sourceIndex);

      // (3) Update internal paths of siblings (and their children)
      minDash.get(schema, sourcePath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));
      const targetPath = [...targetFormField._path, 'components'];

      // (4) Add to row or create new one
      updateRow(formField, targetRow ? targetRow.id : this._formLayouter.nextRowId());

      // (5) Add form field
      arrayAdd$1(minDash.get(schema, targetPath), targetIndex, formField);

      // (6) Update internal paths of siblings (and their children)
      minDash.get(schema, targetPath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

      // (7) Reregister form field (and children) from path registry
      this._pathRegistry.executeRecursivelyOnFields(formField, ({
        field,
        isClosed,
        isRepeatable
      }) => {
        this._pathRegistry.claimPath(this._pathRegistry.getValuePath(field), {
          isClosed,
          isRepeatable,
          claimerId: field.id
        });
      });
    }

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
}
MoveFormFieldHandler.$inject = ['formEditor', 'formFieldRegistry', 'pathRegistry', 'formLayouter'];

class RemoveFormFieldHandler {
  /**
   * @constructor
   * @param { import('../../../FormEditor').FormEditor } formEditor
   * @param { import('../../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
   */
  constructor(formEditor, formFieldRegistry) {
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
  }
  execute(context) {
    const {
      sourceFormField,
      sourceIndex
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    const sourcePath = [...sourceFormField._path, 'components'];
    const formField = context.formField = minDash.get(schema, [...sourcePath, sourceIndex]);

    // (1) Remove form field
    arrayRemove(minDash.get(schema, sourcePath), sourceIndex);

    // (2) Update internal paths of its siblings (and their children)
    minDash.get(schema, sourcePath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

    // (3) Remove form field and children from form field registry
    formJsViewer.runRecursively(formField, formField => this._formFieldRegistry.remove(formField));

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
  revert(context) {
    const {
      formField,
      sourceFormField,
      sourceIndex
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    const sourcePath = [...sourceFormField._path, 'components'];

    // (1) Add form field
    arrayAdd$1(minDash.get(schema, sourcePath), sourceIndex, formField);

    // (2) Update internal paths of its siblings (and their children)
    minDash.get(schema, sourcePath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

    // (3) Add form field and children to form field registry
    formJsViewer.runRecursively(formField, formField => this._formFieldRegistry.add(formField));

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
}
RemoveFormFieldHandler.$inject = ['formEditor', 'formFieldRegistry'];

class UpdateIdClaimHandler {
  /**
   * @constructor
   * @param { import('../../../core/FormFieldRegistry').FormFieldRegistry } formFieldRegistry
   */
  constructor(formFieldRegistry) {
    this._formFieldRegistry = formFieldRegistry;
  }
  execute(context) {
    const {
      claiming,
      formField,
      id
    } = context;
    if (claiming) {
      this._formFieldRegistry._ids.claim(id, formField);
    } else {
      this._formFieldRegistry._ids.unclaim(id);
    }
  }
  revert(context) {
    const {
      claiming,
      formField,
      id
    } = context;
    if (claiming) {
      this._formFieldRegistry._ids.unclaim(id);
    } else {
      this._formFieldRegistry._ids.claim(id, formField);
    }
  }
}
UpdateIdClaimHandler.$inject = ['formFieldRegistry'];

class UpdateKeyClaimHandler {
  /**
   * @constructor
   * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
   */
  constructor(pathRegistry) {
    this._pathRegistry = pathRegistry;
  }
  execute(context) {
    const {
      claiming,
      formField,
      key
    } = context;
    const options = {
      replacements: {
        [formField.id]: key
      }
    };
    const valuePath = this._pathRegistry.getValuePath(formField, options);
    if (claiming) {
      this._pathRegistry.claimPath(valuePath, {
        isClosed: true,
        claimerId: formField.id
      });
    } else {
      this._pathRegistry.unclaimPath(valuePath);
    }

    // cache path for revert
    context.valuePath = valuePath;
  }
  revert(context) {
    const {
      claiming,
      formField,
      valuePath
    } = context;
    if (claiming) {
      this._pathRegistry.unclaimPath(valuePath);
    } else {
      this._pathRegistry.claimPath(valuePath, {
        isClosed: true,
        claimerId: formField.id
      });
    }
  }
}
UpdateKeyClaimHandler.$inject = ['pathRegistry'];

class UpdatePathClaimHandler {
  /**
   * @constructor
   * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
   */
  constructor(pathRegistry) {
    this._pathRegistry = pathRegistry;
  }
  execute(context) {
    const {
      claiming,
      formField,
      path
    } = context;
    const options = {
      replacements: {
        [formField.id]: path
      }
    };
    const valuePaths = [];
    if (claiming) {
      this._pathRegistry.executeRecursivelyOnFields(formField, ({
        field,
        isClosed,
        isRepeatable
      }) => {
        const valuePath = this._pathRegistry.getValuePath(field, options);
        valuePaths.push({
          valuePath,
          isClosed,
          isRepeatable,
          claimerId: field.id
        });
        this._pathRegistry.claimPath(valuePath, {
          isClosed,
          isRepeatable,
          claimerId: field.id
        });
      });
    } else {
      this._pathRegistry.executeRecursivelyOnFields(formField, ({
        field,
        isClosed,
        isRepeatable
      }) => {
        const valuePath = this._pathRegistry.getValuePath(field, options);
        valuePaths.push({
          valuePath,
          isClosed,
          isRepeatable,
          claimerId: field.id
        });
        this._pathRegistry.unclaimPath(valuePath);
      });
    }

    // cache path info for revert
    context.valuePaths = valuePaths;
  }
  revert(context) {
    const {
      claiming,
      valuePaths
    } = context;
    if (claiming) {
      valuePaths.forEach(({
        valuePath
      }) => {
        this._pathRegistry.unclaimPath(valuePath);
      });
    } else {
      valuePaths.forEach(({
        valuePath,
        isClosed,
        isRepeatable,
        claimerId
      }) => {
        this._pathRegistry.claimPath(valuePath, {
          isClosed,
          isRepeatable,
          claimerId
        });
      });
    }
  }
}
UpdatePathClaimHandler.$inject = ['pathRegistry'];

class Modeling {
  constructor(commandStack, eventBus, formEditor, formFieldRegistry, fieldFactory) {
    this._commandStack = commandStack;
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
    this._fieldFactory = fieldFactory;
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
      'formField.add': AddFormFieldHandler,
      'formField.edit': EditFormFieldHandler,
      'formField.move': MoveFormFieldHandler,
      'formField.remove': RemoveFormFieldHandler,
      'id.updateClaim': UpdateIdClaimHandler,
      'key.updateClaim': UpdateKeyClaimHandler,
      'path.updateClaim': UpdatePathClaimHandler
    };
  }
  addFormField(attrs, targetFormField, targetIndex) {
    const formField = this._fieldFactory.create(attrs);
    const context = {
      formField,
      targetFormField,
      targetIndex
    };
    this._commandStack.execute('formField.add', context);
    return formField;
  }
  editFormField(formField, properties, value) {
    if (!minDash.isObject(properties)) {
      properties = {
        [properties]: value
      };
    }
    const context = {
      formField,
      properties
    };
    this._commandStack.execute('formField.edit', context);
  }
  moveFormField(formField, sourceFormField, targetFormField, sourceIndex, targetIndex, sourceRow, targetRow) {
    const context = {
      formField,
      sourceFormField,
      targetFormField,
      sourceIndex,
      targetIndex,
      sourceRow,
      targetRow
    };
    this._commandStack.execute('formField.move', context);
  }
  removeFormField(formField, sourceFormField, sourceIndex) {
    const context = {
      formField,
      sourceFormField,
      sourceIndex
    };
    this._commandStack.execute('formField.remove', context);
  }
  claimId(formField, id) {
    const context = {
      formField,
      id,
      claiming: true
    };
    this._commandStack.execute('id.updateClaim', context);
  }
  unclaimId(formField, id) {
    const context = {
      formField,
      id,
      claiming: false
    };
    this._commandStack.execute('id.updateClaim', context);
  }
  claimKey(formField, key) {
    const context = {
      formField,
      key,
      claiming: true
    };
    this._commandStack.execute('key.updateClaim', context);
  }
  unclaimKey(formField, key) {
    const context = {
      formField,
      key,
      claiming: false
    };
    this._commandStack.execute('key.updateClaim', context);
  }
  claimPath(formField, path) {
    const context = {
      formField,
      path,
      claiming: true
    };
    this._commandStack.execute('path.updateClaim', context);
  }
  unclaimPath(formField, path) {
    const context = {
      formField,
      path,
      claiming: false
    };
    this._commandStack.execute('path.updateClaim', context);
  }
}
Modeling.$inject = ['commandStack', 'eventBus', 'formEditor', 'formFieldRegistry', 'fieldFactory'];

const ModelingModule = {
  __depends__: [BehaviorModule, commandModule],
  __init__: ['formLayoutUpdater', 'modeling'],
  formLayoutUpdater: ['type', FormLayoutUpdater],
  modeling: ['type', Modeling]
};

class Selection {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._selection = null;
  }
  get() {
    return this._selection;
  }
  set(selection) {
    if (this._selection === selection) {
      return;
    }
    this._selection = selection;
    this._eventBus.fire('selection.changed', {
      selection: this._selection
    });
  }
  toggle(selection) {
    const newSelection = this._selection === selection ? null : selection;
    this.set(newSelection);
  }
  clear() {
    this.set(null);
  }
  isSelected(formField) {
    return this._selection === formField;
  }
}
Selection.$inject = ['eventBus'];

class SelectionBehavior {
  constructor(eventBus, selection) {
    eventBus.on(['commandStack.formField.add.postExecuted', 'commandStack.formField.move.postExecuted'], ({
      context
    }) => {
      const {
        formField
      } = context;
      selection.set(formField);
    });
    eventBus.on('commandStack.formField.remove.postExecuted', ({
      context
    }) => {
      const {
        sourceFormField,
        sourceIndex
      } = context;
      const formField = sourceFormField.components[sourceIndex] || sourceFormField.components[sourceIndex - 1];
      if (formField) {
        selection.set(formField);
      } else {
        selection.clear();
      }
    });
    eventBus.on('formField.remove', ({
      formField
    }) => {
      if (selection.isSelected(formField)) {
        selection.clear();
      }
    });
  }
}
SelectionBehavior.$inject = ['eventBus', 'selection'];

const SelectionModule = {
  __init__: ['selection', 'selectionBehavior'],
  selection: ['type', Selection],
  selectionBehavior: ['type', SelectionBehavior]
};

/**
 * Base class for sectionable UI modules.
 *
 * @property {EventBus} _eventBus - EventBus instance used for event handling.
 * @property {string} managerType - Type of the render manager. Used to form event names.
 *
 * @class SectionModuleBase
 */
class SectionModuleBase {
  /**
   * Create a SectionModuleBase instance.
   *
   * @param {any} eventBus - The EventBus instance used for event handling.
   * @param {string} sectionKey - The type of render manager. Used to form event names.
   *
   * @constructor
   */
  constructor(eventBus, sectionKey) {
    this._eventBus = eventBus;
    this._sectionKey = sectionKey;
    this._eventBus.on(`${this._sectionKey}.section.rendered`, () => {
      this.isSectionRendered = true;
    });
    this._eventBus.on(`${this._sectionKey}.section.destroyed`, () => {
      this.isSectionRendered = false;
    });
  }

  /**
   * Attach the managed section to a parent node.
   *
   * @param {HTMLElement} container - The parent node to attach to.
   */
  attachTo(container) {
    this._onceSectionRendered(() => this._eventBus.fire(`${this._sectionKey}.attach`, {
      container
    }));
  }

  /**
   * Detach the managed section from its parent node.
   */
  detach() {
    this._onceSectionRendered(() => this._eventBus.fire(`${this._sectionKey}.detach`));
  }

  /**
   * Reset the managed section to its initial state.
   */
  reset() {
    this._onceSectionRendered(() => this._eventBus.fire(`${this._sectionKey}.reset`));
  }

  /**
   * Circumvents timing issues.
   */
  _onceSectionRendered(callback) {
    if (this.isSectionRendered) {
      callback();
    } else {
      this._eventBus.once(`${this._sectionKey}.section.rendered`, callback);
    }
  }
}

class PaletteRenderer extends SectionModuleBase {
  constructor(eventBus) {
    super(eventBus, 'palette');
  }
}
PaletteRenderer.$inject = ['eventBus'];

const PaletteModule = {
  __init__: ['palette'],
  palette: ['type', PaletteRenderer]
};

var ArrowIcon = function ArrowIcon(props) {
  return jsxRuntime.jsx("svg", {
    ...props,
    children: jsxRuntime.jsx("path", {
      fillRule: "evenodd",
      d: "m11.657 8-4.95 4.95a1 1 0 0 1-1.414-1.414L8.828 8 5.293 4.464A1 1 0 1 1 6.707 3.05L11.657 8Z"
    })
  });
};
ArrowIcon.defaultProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16"
};
var CreateIcon = function CreateIcon(props) {
  return jsxRuntime.jsx("svg", {
    ...props,
    children: jsxRuntime.jsx("path", {
      fillRule: "evenodd",
      d: "M9 13V9h4a1 1 0 0 0 0-2H9V3a1 1 0 1 0-2 0v4H3a1 1 0 1 0 0 2h4v4a1 1 0 0 0 2 0Z"
    })
  });
};
CreateIcon.defaultProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16"
};
var DeleteIcon = function DeleteIcon(props) {
  return jsxRuntime.jsx("svg", {
    ...props,
    children: jsxRuntime.jsx("path", {
      fillRule: "evenodd",
      d: "M12 6v7c0 1.1-.4 1.55-1.5 1.55h-5C4.4 14.55 4 14.1 4 13V6h8Zm-1.5 1.5h-5v4.3c0 .66.5 1.2 1.111 1.2H9.39c.611 0 1.111-.54 1.111-1.2V7.5ZM13 3h-2l-1-1H6L5 3H3v1.5h10V3Z"
    })
  });
};
DeleteIcon.defaultProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16"
};
var DragIcon = function DragIcon(props) {
  return jsxRuntime.jsxs("svg", {
    ...props,
    children: [jsxRuntime.jsx("path", {
      fill: "#fff",
      style: {
        mixBlendMode: "multiply"
      },
      d: "M0 0h16v16H0z"
    }), jsxRuntime.jsx("path", {
      fill: "#fff",
      style: {
        mixBlendMode: "multiply"
      },
      d: "M0 0h16v16H0z"
    }), jsxRuntime.jsx("path", {
      d: "M7 3H5v2h2V3zm4 0H9v2h2V3zM7 7H5v2h2V7zm4 0H9v2h2V7zm-4 4H5v2h2v-2zm4 0H9v2h2v-2z",
      fill: "#161616"
    })]
  });
};
DragIcon.defaultProps = {
  width: "16",
  height: "16",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg"
};
var ExternalLinkIcon = function ExternalLinkIcon(props) {
  return jsxRuntime.jsx("svg", {
    ...props,
    children: jsxRuntime.jsx("path", {
      fillRule: "evenodd",
      clipRule: "evenodd",
      d: "M12.637 12.637v-4.72h1.362v4.721c0 .36-.137.676-.411.95-.275.275-.591.412-.95.412H3.362c-.38 0-.703-.132-.967-.396A1.315 1.315 0 0 1 2 12.638V3.362c0-.38.132-.703.396-.967S2.982 2 3.363 2h4.553v1.363H3.363v9.274h9.274ZM14 2H9.28l-.001 1.362h2.408L5.065 9.984l.95.95 6.622-6.622v2.409H14V2Z",
      fill: "currentcolor"
    })
  });
};
ExternalLinkIcon.defaultProps = {
  width: "16",
  height: "16",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg"
};
var FeelIcon$1 = function FeelIcon(props) {
  return jsxRuntime.jsx("svg", {
    ...props,
    children: jsxRuntime.jsx("path", {
      d: "M3.617 11.99c-.137.684-.392 1.19-.765 1.518-.362.328-.882.492-1.558.492H0l.309-1.579h1.264l1.515-7.64h-.912l.309-1.579h.911l.236-1.191c.137-.685.387-1.192.75-1.52C4.753.164 5.277 0 5.953 0h1.294L6.94 1.579H5.675l-.323 1.623h1.264l-.309 1.579H5.043l-1.426 7.208ZM5.605 11.021l3.029-4.155L7.28 3.202h2.073l.706 2.547h.176l1.691-2.547H14l-3.014 4.051 1.338 3.768H10.25l-.706-2.606H9.37L7.678 11.02H5.605Z",
      fill: "currentcolor"
    })
  });
};
FeelIcon$1.defaultProps = {
  width: "14",
  height: "14",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg"
};
var HelpIcon = function HelpIcon(props) {
  return jsxRuntime.jsxs("svg", {
    ...props,
    children: [jsxRuntime.jsx("path", {
      d: "M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2Zm0 26a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z"
    }), jsxRuntime.jsx("circle", {
      cx: "16",
      cy: "23.5",
      r: "1.5"
    }), jsxRuntime.jsx("path", {
      d: "M17 8h-1.5a4.49 4.49 0 0 0-4.5 4.5v.5h2v-.5a2.5 2.5 0 0 1 2.5-2.5H17a2.5 2.5 0 0 1 0 5h-2v4.5h2V17a4.5 4.5 0 0 0 0-9Z"
    }), jsxRuntime.jsx("path", {
      style: {
        fill: "none"
      },
      d: "M0 0h32v32H0z"
    })]
  });
};
HelpIcon.defaultProps = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 32 32"
};
var PopupIcon = function PopupIcon(props) {
  return jsxRuntime.jsxs("svg", {
    ...props,
    children: [jsxRuntime.jsx("path", {
      fill: "currentColor",
      d: "M28 4H10a2.006 2.006 0 0 0-2 2v14a2.006 2.006 0 0 0 2 2h18a2.006 2.006 0 0 0 2-2V6a2.006 2.006 0 0 0-2-2Zm0 16H10V6h18Z"
    }), jsxRuntime.jsx("path", {
      fill: "currentColor",
      d: "M18 26H4V16h2v-2H4a2.006 2.006 0 0 0-2 2v10a2.006 2.006 0 0 0 2 2h14a2.006 2.006 0 0 0 2-2v-2h-2Z"
    })]
  });
};
PopupIcon.defaultProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16",
  viewBox: "0 0 32 32"
};
function Header(props) {
  const {
    element,
    headerProvider
  } = props;
  const {
    getElementIcon,
    getDocumentationRef,
    getElementLabel,
    getTypeLabel
  } = headerProvider;
  const label = getElementLabel(element);
  const type = getTypeLabel(element);
  const documentationRef = getDocumentationRef && getDocumentationRef(element);
  const ElementIcon = getElementIcon(element);
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-header",
    children: [jsxRuntime.jsx("div", {
      class: "bio-properties-panel-header-icon",
      children: ElementIcon && jsxRuntime.jsx(ElementIcon, {
        width: "32",
        height: "32",
        viewBox: "0 0 32 32"
      })
    }), jsxRuntime.jsxs("div", {
      class: "bio-properties-panel-header-labels",
      children: [jsxRuntime.jsx("div", {
        title: type,
        class: "bio-properties-panel-header-type",
        children: type
      }), label ? jsxRuntime.jsx("div", {
        title: label,
        class: "bio-properties-panel-header-label",
        children: label
      }) : null]
    }), jsxRuntime.jsx("div", {
      class: "bio-properties-panel-header-actions",
      children: documentationRef ? jsxRuntime.jsx("a", {
        rel: "noopener",
        class: "bio-properties-panel-header-link",
        href: documentationRef,
        title: "Open documentation",
        target: "_blank",
        children: jsxRuntime.jsx(ExternalLinkIcon, {})
      }) : null
    })]
  });
}
const DescriptionContext = preact.createContext({
  description: {},
  getDescriptionForId: () => {}
});
const ErrorsContext = preact.createContext({
  errors: {}
});

/**
 * @typedef {Function} <propertiesPanel.showEntry> callback
 *
 * @example
 *
 * useEvent('propertiesPanel.showEntry', ({ focus = false, ...rest }) => {
 *   // ...
 * });
 *
 * @param {Object} context
 * @param {boolean} [context.focus]
 *
 * @returns void
 */

const EventContext = preact.createContext({
  eventBus: null
});
const LayoutContext = preact.createContext({
  layout: {},
  setLayout: () => {},
  getLayoutForKey: () => {},
  setLayoutForKey: () => {}
});
const TooltipContext = preact.createContext({
  tooltip: {},
  getTooltipForId: () => {}
});

/**
 * Accesses the global TooltipContext and returns a tooltip for a given id and element.
 *
 * @example
 * ```jsx
 * function TextField(props) {
 *   const tooltip = useTooltipContext('input1', element);
 * }
 * ```
 *
 * @param {string} id
 * @param {object} element
 *
 * @returns {string}
 */
function useTooltipContext(id, element) {
  const {
    getTooltipForId
  } = hooks.useContext(TooltipContext);
  return getTooltipForId(id, element);
}
function TooltipWrapper(props) {
  const {
    forId,
    element
  } = props;
  const contextDescription = useTooltipContext(forId, element);
  const value = props.value || contextDescription;
  if (!value) {
    return props.children;
  }
  return jsxRuntime.jsx(Tooltip, {
    ...props,
    value: value,
    forId: prefixId$9(forId)
  });
}
function Tooltip(props) {
  const {
    forId,
    value,
    parent,
    direction = 'right',
    position
  } = props;
  const [visible, setShow] = hooks.useState(false);
  const [focusedViaKeyboard, setFocusedViaKeyboard] = hooks.useState(false);
  let timeout = null;
  const wrapperRef = hooks.useRef(null);
  const tooltipRef = hooks.useRef(null);
  const showTooltip = async event => {
    const show = () => setShow(true);
    if (!visible && !timeout) {
      if (event instanceof MouseEvent) {
        timeout = setTimeout(show, 200);
      } else {
        show();
        setFocusedViaKeyboard(true);
      }
    }
  };
  const hideTooltip = () => {
    setShow(false);
    setFocusedViaKeyboard(false);
  };
  const hideTooltipViaEscape = e => {
    e.code === 'Escape' && hideTooltip();
  };
  const isTooltipHovered = ({
    x,
    y
  }) => {
    const tooltip = tooltipRef.current;
    const wrapper = wrapperRef.current;
    return tooltip && (inBounds(x, y, wrapper.getBoundingClientRect()) || inBounds(x, y, tooltip.getBoundingClientRect()));
  };
  hooks.useEffect(() => {
    const {
      current
    } = wrapperRef;
    if (!current) {
      return;
    }
    const hideHoveredTooltip = e => {
      const isFocused = document.activeElement === wrapperRef.current || document.activeElement.closest('.bio-properties-panel-tooltip');
      if (visible && !isTooltipHovered({
        x: e.x,
        y: e.y
      }) && !(isFocused && focusedViaKeyboard)) {
        hideTooltip();
      }
    };
    const hideFocusedTooltip = e => {
      const {
        relatedTarget
      } = e;
      const isTooltipChild = el => !!el.closest('.bio-properties-panel-tooltip');
      if (visible && !isHovered(wrapperRef.current) && relatedTarget && !isTooltipChild(relatedTarget)) {
        hideTooltip();
      }
    };
    document.addEventListener('wheel', hideHoveredTooltip);
    document.addEventListener('focusout', hideFocusedTooltip);
    document.addEventListener('mousemove', hideHoveredTooltip);
    return () => {
      document.removeEventListener('wheel', hideHoveredTooltip);
      document.removeEventListener('mousemove', hideHoveredTooltip);
      document.removeEventListener('focusout', hideFocusedTooltip);
    };
  }, [wrapperRef.current, visible, focusedViaKeyboard]);
  const renderTooltip = () => {
    return jsxRuntime.jsxs("div", {
      class: `bio-properties-panel-tooltip ${direction}`,
      role: "tooltip",
      id: "bio-properties-panel-tooltip",
      "aria-labelledby": forId,
      style: position || getTooltipPosition(wrapperRef.current),
      ref: tooltipRef,
      onClick: e => e.stopPropagation(),
      children: [jsxRuntime.jsx("div", {
        class: "bio-properties-panel-tooltip-content",
        children: value
      }), jsxRuntime.jsx("div", {
        class: "bio-properties-panel-tooltip-arrow"
      })]
    });
  };
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-tooltip-wrapper",
    tabIndex: "0",
    ref: wrapperRef,
    onMouseEnter: showTooltip,
    onMouseLeave: () => {
      clearTimeout(timeout);
      timeout = null;
    },
    onFocus: showTooltip,
    onKeyDown: hideTooltipViaEscape,
    children: [props.children, visible ? parent ? React.createPortal(renderTooltip(), parent.current) : renderTooltip() : null]
  });
}

// helper
function inBounds(x, y, bounds) {
  const {
    top,
    right,
    bottom,
    left
  } = bounds;
  return x >= left && x <= right && y >= top && y <= bottom;
}
function getTooltipPosition(refElement) {
  const refPosition = refElement.getBoundingClientRect();
  const right = `calc(100% - ${refPosition.x}px)`;
  const top = `${refPosition.top - 10}px`;
  return `right: ${right}; top: ${top};`;
}
function isHovered(element) {
  return element.matches(':hover');
}
function prefixId$9(id) {
  return `bio-properties-panel-${id}`;
}

/**
 * Accesses the global DescriptionContext and returns a description for a given id and element.
 *
 * @example
 * ```jsx
 * function TextField(props) {
 *   const description = useDescriptionContext('input1', element);
 * }
 * ```
 *
 * @param {string} id
 * @param {object} element
 *
 * @returns {string}
 */
function useDescriptionContext(id, element) {
  const {
    getDescriptionForId
  } = hooks.useContext(DescriptionContext);
  return getDescriptionForId(id, element);
}
function useError(id) {
  const {
    errors
  } = hooks.useContext(ErrorsContext);
  return errors[id];
}
function useErrors() {
  const {
    errors
  } = hooks.useContext(ErrorsContext);
  return errors;
}

/**
 * Subscribe to an event immediately. Update subscription after inputs changed.
 *
 * @param {string} event
 * @param {Function} callback
 */
function useEvent(event, callback, eventBus) {
  const eventContext = hooks.useContext(EventContext);
  if (!eventBus) {
    ({
      eventBus
    } = eventContext);
  }
  const didMount = hooks.useRef(false);

  // (1) subscribe immediately
  if (eventBus && !didMount.current) {
    eventBus.on(event, callback);
  }

  // (2) update subscription after inputs changed
  hooks.useEffect(() => {
    if (eventBus && didMount.current) {
      eventBus.on(event, callback);
    }
    didMount.current = true;
    return () => {
      if (eventBus) {
        eventBus.off(event, callback);
      }
    };
  }, [callback, event, eventBus]);
}

/**
 * Creates a state that persists in the global LayoutContext.
 *
 * @example
 * ```jsx
 * function Group(props) {
 *   const [ open, setOpen ] = useLayoutState([ 'groups', 'foo', 'open' ], false);
 * }
 * ```
 *
 * @param {(string|number)[]} path
 * @param {any} [defaultValue]
 *
 * @returns {[ any, Function ]}
 */
function useLayoutState(path, defaultValue) {
  const {
    getLayoutForKey,
    setLayoutForKey
  } = hooks.useContext(LayoutContext);
  const layoutForKey = getLayoutForKey(path, defaultValue);
  const setState = hooks.useCallback(newValue => {
    setLayoutForKey(path, newValue);
  }, [setLayoutForKey]);
  return [layoutForKey, setState];
}

/**
 * @pinussilvestrus: we need to introduce our own hook to persist the previous
 * state on updates.
 *
 * cf. https://reactjs.org/docs/hooks-faq.html#how-to-get-the-previous-props-or-state
 */

function usePrevious(value) {
  const ref = hooks.useRef();
  hooks.useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

/**
 * Subscribe to `propertiesPanel.showEntry`.
 *
 * @param {string} id
 *
 * @returns {import('preact').Ref}
 */
function useShowEntryEvent(id) {
  const {
    onShow
  } = hooks.useContext(LayoutContext);
  const ref = hooks.useRef();
  const focus = hooks.useRef(false);
  const onShowEntry = hooks.useCallback(event => {
    if (event.id === id) {
      onShow();
      if (!focus.current) {
        focus.current = true;
      }
    }
  }, [id]);
  hooks.useEffect(() => {
    if (focus.current && ref.current) {
      if (minDash.isFunction(ref.current.focus)) {
        ref.current.focus();
      }
      if (minDash.isFunction(ref.current.select)) {
        ref.current.select();
      }
      focus.current = false;
    }
  });
  useEvent('propertiesPanel.showEntry', onShowEntry);
  return ref;
}

/**
 * @callback setSticky
 * @param {boolean} value
 */

/**
 * Use IntersectionObserver to identify when DOM element is in sticky mode.
 * If sticky is observered setSticky(true) will be called.
 * If sticky mode is left, setSticky(false) will be called.
 *
 *
 * @param {Object} ref
 * @param {string} scrollContainerSelector
 * @param {setSticky} setSticky
 */
function useStickyIntersectionObserver(ref, scrollContainerSelector, setSticky) {
  const [scrollContainer, setScrollContainer] = hooks.useState(minDom.query(scrollContainerSelector));
  const updateScrollContainer = hooks.useCallback(() => {
    const newScrollContainer = minDom.query(scrollContainerSelector);
    if (newScrollContainer !== scrollContainer) {
      setScrollContainer(newScrollContainer);
    }
  }, [scrollContainerSelector, scrollContainer]);
  hooks.useEffect(() => {
    updateScrollContainer();
  }, [updateScrollContainer]);
  useEvent('propertiesPanel.attach', updateScrollContainer);
  useEvent('propertiesPanel.detach', updateScrollContainer);
  hooks.useEffect(() => {
    const Observer = IntersectionObserver;

    // return early if IntersectionObserver is not available
    if (!Observer) {
      return;
    }

    // TODO(@barmac): test this
    if (!ref.current || !scrollContainer) {
      return;
    }
    const observer = new Observer(entries => {
      // scroll container is unmounted, do not update sticky state
      if (scrollContainer.scrollHeight === 0) {
        return;
      }
      entries.forEach(entry => {
        if (entry.intersectionRatio < 1) {
          setSticky(true);
        } else if (entry.intersectionRatio === 1) {
          setSticky(false);
        }
      });
    }, {
      root: scrollContainer,
      rootMargin: '0px 0px 999999% 0px',
      // Use bottom margin to avoid stickyness when scrolling out to bottom
      threshold: [1]
    });
    observer.observe(ref.current);

    // Unobserve if unmounted
    return () => {
      observer.unobserve(ref.current);
    };
  }, [ref.current, scrollContainer, setSticky]);
}

/**
 * Creates a static function reference with changing body.
 * This is necessary when external libraries require a callback function
 * that has references to state variables.
 *
 * Usage:
 * const callback = useStaticCallback((val) => {val === currentState});
 *
 * The `callback` reference is static and can be safely used in external
 * libraries or as a prop that does not cause rerendering of children.
 *
 * @param {Function} callback function with changing reference
 * @returns {Function} static function reference
 */
function useStaticCallback(callback) {
  const callbackRef = hooks.useRef(callback);
  callbackRef.current = callback;
  return hooks.useCallback((...args) => callbackRef.current(...args), []);
}
function Group(props) {
  const {
    element,
    entries = [],
    id,
    label,
    shouldOpen = false
  } = props;
  const groupRef = hooks.useRef(null);
  const [open, setOpen] = useLayoutState(['groups', id, 'open'], shouldOpen);
  const onShow = hooks.useCallback(() => setOpen(true), [setOpen]);
  const toggleOpen = () => setOpen(!open);
  const [edited, setEdited] = hooks.useState(false);
  const [sticky, setSticky] = hooks.useState(false);

  // set edited state depending on all entries
  hooks.useEffect(() => {
    // TODO(@barmac): replace with CSS when `:has()` is supported in all major browsers, or rewrite as in https://github.com/camunda/camunda-modeler/issues/3815#issuecomment-1733038161
    const scheduled = requestAnimationFrame(() => {
      const hasOneEditedEntry = entries.find(entry => {
        const {
          id,
          isEdited
        } = entry;
        const entryNode = minDom.query(`[data-entry-id="${id}"]`);
        if (!minDash.isFunction(isEdited) || !entryNode) {
          return false;
        }
        const inputNode = minDom.query('.bio-properties-panel-input', entryNode);
        return isEdited(inputNode);
      });
      setEdited(hasOneEditedEntry);
    });
    return () => cancelAnimationFrame(scheduled);
  }, [entries, setEdited]);

  // set error state depending on all entries
  const allErrors = useErrors();
  const hasErrors = entries.some(entry => allErrors[entry.id]);

  // set css class when group is sticky to top
  useStickyIntersectionObserver(groupRef, 'div.bio-properties-panel-scroll-container', setSticky);
  const propertiesPanelContext = {
    ...hooks.useContext(LayoutContext),
    onShow
  };
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-group",
    "data-group-id": 'group-' + id,
    ref: groupRef,
    children: [jsxRuntime.jsxs("div", {
      class: classnames('bio-properties-panel-group-header', edited ? '' : 'empty', open ? 'open' : '', sticky && open ? 'sticky' : ''),
      onClick: toggleOpen,
      children: [jsxRuntime.jsx("div", {
        title: props.tooltip ? null : label,
        "data-title": label,
        class: "bio-properties-panel-group-header-title",
        children: jsxRuntime.jsx(TooltipWrapper, {
          value: props.tooltip,
          forId: 'group-' + id,
          element: element,
          parent: groupRef,
          children: label
        })
      }), jsxRuntime.jsxs("div", {
        class: "bio-properties-panel-group-header-buttons",
        children: [jsxRuntime.jsx(DataMarker, {
          edited: edited,
          hasErrors: hasErrors
        }), jsxRuntime.jsx("button", {
          type: "button",
          title: "Toggle section",
          class: "bio-properties-panel-group-header-button bio-properties-panel-arrow",
          children: jsxRuntime.jsx(ArrowIcon, {
            class: open ? 'bio-properties-panel-arrow-down' : 'bio-properties-panel-arrow-right'
          })
        })]
      })]
    }), jsxRuntime.jsx("div", {
      class: classnames('bio-properties-panel-group-entries', open ? 'open' : ''),
      children: jsxRuntime.jsx(LayoutContext.Provider, {
        value: propertiesPanelContext,
        children: entries.map(entry => {
          const {
            component: Component,
            id
          } = entry;
          return preact.createElement(Component, {
            ...entry,
            element: element,
            key: id
          });
        })
      })
    })]
  });
}
function DataMarker(props) {
  const {
    edited,
    hasErrors
  } = props;
  if (hasErrors) {
    return jsxRuntime.jsx("div", {
      title: "Section contains an error",
      class: "bio-properties-panel-dot bio-properties-panel-dot--error"
    });
  }
  if (edited) {
    return jsxRuntime.jsx("div", {
      title: "Section contains data",
      class: "bio-properties-panel-dot"
    });
  }
  return null;
}

/**
 * @typedef { {
 *  text: (element: object) => string,
 *  icon?: (element: Object) => import('preact').Component
 * } } PlaceholderDefinition
 *
 * @param { PlaceholderDefinition } props
 */
function Placeholder(props) {
  const {
    text,
    icon: Icon
  } = props;
  return jsxRuntime.jsx("div", {
    class: "bio-properties-panel open",
    children: jsxRuntime.jsxs("section", {
      class: "bio-properties-panel-placeholder",
      children: [Icon && jsxRuntime.jsx(Icon, {
        class: "bio-properties-panel-placeholder-icon"
      }), jsxRuntime.jsx("p", {
        class: "bio-properties-panel-placeholder-text",
        children: text
      })]
    })
  });
}
function Description$1(props) {
  const {
    element,
    forId,
    value
  } = props;
  const contextDescription = useDescriptionContext(forId, element);
  const description = value || contextDescription;
  if (description) {
    return jsxRuntime.jsx("div", {
      class: "bio-properties-panel-description",
      children: description
    });
  }
}
const noop$6 = () => {};

/**
 * Buffer `.focus()` calls while the editor is not initialized.
 * Set Focus inside when the editor is ready.
 */
const useBufferedFocus$1 = function (editor, ref) {
  const [buffer, setBuffer] = hooks.useState(undefined);
  ref.current = hooks.useMemo(() => ({
    focus: offset => {
      if (editor) {
        editor.focus(offset);
      } else {
        if (typeof offset === 'undefined') {
          offset = Infinity;
        }
        setBuffer(offset);
      }
    }
  }), [editor]);
  hooks.useEffect(() => {
    if (typeof buffer !== 'undefined' && editor) {
      editor.focus(buffer);
      setBuffer(false);
    }
  }, [editor, buffer]);
};
const CodeEditor$1 = React.forwardRef((props, ref) => {
  const {
    onInput,
    disabled,
    tooltipContainer,
    enableGutters,
    value,
    onLint = noop$6,
    onPopupOpen = noop$6,
    popupOpen,
    contentAttributes = {},
    hostLanguage = null,
    singleLine = false
  } = props;
  const inputRef = hooks.useRef();
  const [editor, setEditor] = hooks.useState();
  const [localValue, setLocalValue] = hooks.useState(value || '');
  useBufferedFocus$1(editor, ref);
  const handleInput = useStaticCallback(newValue => {
    onInput(newValue);
    setLocalValue(newValue);
  });
  hooks.useEffect(() => {
    let editor;
    editor = new feelers.FeelersEditor({
      container: inputRef.current,
      onChange: handleInput,
      value: localValue,
      onLint,
      contentAttributes,
      tooltipContainer,
      enableGutters,
      hostLanguage,
      singleLine
    });
    setEditor(editor);
    return () => {
      onLint([]);
      inputRef.current.innerHTML = '';
      setEditor(null);
    };
  }, []);
  hooks.useEffect(() => {
    if (!editor) {
      return;
    }
    if (value === localValue) {
      return;
    }
    editor.setValue(value);
    setLocalValue(value);
  }, [value]);
  const handleClick = () => {
    ref.current.focus();
  };
  return jsxRuntime.jsxs("div", {
    class: classnames('bio-properties-panel-feelers-editor-container', popupOpen ? 'popupOpen' : null),
    children: [jsxRuntime.jsx("div", {
      class: "bio-properties-panel-feelers-editor__open-popup-placeholder",
      children: "Opened in editor"
    }), jsxRuntime.jsx("div", {
      name: props.name,
      class: classnames('bio-properties-panel-feelers-editor bio-properties-panel-input', localValue ? 'edited' : null, disabled ? 'disabled' : null),
      ref: inputRef,
      onClick: handleClick
    }), jsxRuntime.jsx("button", {
      type: "button",
      title: "Open pop-up editor",
      class: "bio-properties-panel-open-feel-popup",
      onClick: () => onPopupOpen('feelers'),
      children: jsxRuntime.jsx(ExternalLinkIcon, {})
    })]
  });
});
const noop$5 = () => {};

/**
 * Buffer `.focus()` calls while the editor is not initialized.
 * Set Focus inside when the editor is ready.
 */
const useBufferedFocus = function (editor, ref) {
  const [buffer, setBuffer] = hooks.useState(undefined);
  ref.current = hooks.useMemo(() => ({
    focus: offset => {
      if (editor) {
        editor.focus(offset);
      } else {
        if (typeof offset === 'undefined') {
          offset = Infinity;
        }
        setBuffer(offset);
      }
    }
  }), [editor]);
  hooks.useEffect(() => {
    if (typeof buffer !== 'undefined' && editor) {
      editor.focus(buffer);
      setBuffer(false);
    }
  }, [editor, buffer]);
};
const CodeEditor = React.forwardRef((props, ref) => {
  const {
    enableGutters,
    value,
    onInput,
    onFeelToggle = noop$5,
    onLint = noop$5,
    onPopupOpen = noop$5,
    popupOpen,
    disabled,
    tooltipContainer,
    variables
  } = props;
  const inputRef = hooks.useRef();
  const [editor, setEditor] = hooks.useState();
  const [localValue, setLocalValue] = hooks.useState(value || '');
  useBufferedFocus(editor, ref);
  const handleInput = useStaticCallback(newValue => {
    onInput(newValue);
    setLocalValue(newValue);
  });
  hooks.useEffect(() => {
    let editor;

    /* Trigger FEEL toggle when
     *
     * - `backspace` is pressed
     * - AND the cursor is at the beginning of the input
     */
    const onKeyDown = e => {
      if (e.key !== 'Backspace' || !editor) {
        return;
      }
      const selection = editor.getSelection();
      const range = selection.ranges[selection.mainIndex];
      if (range.from === 0 && range.to === 0) {
        onFeelToggle();
      }
    };
    editor = new FeelEditor({
      container: inputRef.current,
      onChange: handleInput,
      onKeyDown: onKeyDown,
      onLint: onLint,
      tooltipContainer: tooltipContainer,
      value: localValue,
      variables: variables,
      extensions: [...(enableGutters ? [view.lineNumbers()] : []), view.EditorView.lineWrapping]
    });
    setEditor(editor);
    return () => {
      onLint([]);
      inputRef.current.innerHTML = '';
      setEditor(null);
    };
  }, []);
  hooks.useEffect(() => {
    if (!editor) {
      return;
    }
    if (value === localValue) {
      return;
    }
    editor.setValue(value);
    setLocalValue(value);
  }, [value]);
  hooks.useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setVariables(variables);
  }, [variables]);
  const handleClick = () => {
    ref.current.focus();
  };
  return jsxRuntime.jsxs("div", {
    class: classnames('bio-properties-panel-feel-editor-container', disabled ? 'disabled' : null, popupOpen ? 'popupOpen' : null),
    children: [jsxRuntime.jsx("div", {
      class: "bio-properties-panel-feel-editor__open-popup-placeholder",
      children: "Opened in editor"
    }), jsxRuntime.jsx("div", {
      name: props.name,
      class: classnames('bio-properties-panel-input', localValue ? 'edited' : null),
      ref: inputRef,
      onClick: handleClick
    }), jsxRuntime.jsx("button", {
      type: "button",
      title: "Open pop-up editor",
      class: "bio-properties-panel-open-feel-popup",
      onClick: () => onPopupOpen(),
      children: jsxRuntime.jsx(PopupIcon, {})
    })]
  });
});
function FeelIndicator(props) {
  const {
    active
  } = props;
  if (!active) {
    return null;
  }
  return jsxRuntime.jsx("span", {
    class: "bio-properties-panel-feel-indicator",
    children: "="
  });
}
const noop$4 = () => {};

/**
 * @param {Object} props
 * @param {Object} props.label
 * @param {String} props.feel
 */
function FeelIcon(props) {
  const {
    feel = false,
    active,
    disabled = false,
    onClick = noop$4
  } = props;
  const feelRequiredLabel = 'FEEL expression is mandatory';
  const feelOptionalLabel = `Click to ${active ? 'remove' : 'set a'} dynamic value with FEEL expression`;
  const handleClick = e => {
    onClick(e);

    // when pointer event was created from keyboard, keep focus on button
    if (!e.pointerType) {
      e.stopPropagation();
    }
  };
  return jsxRuntime.jsx("button", {
    type: "button",
    class: classnames('bio-properties-panel-feel-icon', active ? 'active' : null, feel === 'required' ? 'required' : 'optional'),
    onClick: handleClick,
    disabled: feel === 'required' || disabled,
    title: feel === 'required' ? feelRequiredLabel : feelOptionalLabel,
    children: jsxRuntime.jsx(FeelIcon$1, {})
  });
}
const FeelPopupContext = preact.createContext({
  open: () => {},
  close: () => {},
  source: null
});

/**
 * Add a dragger that calls back the passed function with
 * { event, delta } on drag.
 *
 * @example
 *
 * function dragMove(event, delta) {
 *   // we are dragging (!!)
 * }
 *
 * domElement.addEventListener('dragstart', dragger(dragMove));
 *
 * @param {Function} fn
 * @param {Element} [dragPreview]
 *
 * @return {Function} drag start callback function
 */
function createDragger(fn, dragPreview) {
  let self;
  let startX, startY;

  /** drag start */
  function onDragStart(event) {
    self = this;
    startX = event.clientX;
    startY = event.clientY;

    // (1) prevent preview image
    if (event.dataTransfer) {
      event.dataTransfer.setDragImage(dragPreview || emptyCanvas(), 0, 0);
    }

    // (2) setup drag listeners

    // attach drag + cleanup event
    // we need to do this to make sure we track cursor
    // movements before we reach other drag event handlers,
    // e.g. in child containers.
    document.addEventListener('dragover', onDrag, true);
    document.addEventListener('dragenter', preventDefault, true);
    document.addEventListener('dragend', onEnd);
    document.addEventListener('drop', preventDefault);
  }
  function onDrag(event) {
    const delta = {
      x: event.clientX - startX,
      y: event.clientY - startY
    };

    // call provided fn with event, delta
    return fn.call(self, event, delta);
  }
  function onEnd() {
    document.removeEventListener('dragover', onDrag, true);
    document.removeEventListener('dragenter', preventDefault, true);
    document.removeEventListener('dragend', onEnd);
    document.removeEventListener('drop', preventDefault);
  }
  return onDragStart;
}
function preventDefault(event) {
  event.preventDefault();
  event.stopPropagation();
}
function emptyCanvas() {
  return minDom.domify('<canvas width="0" height="0" />');
}
const noop$3 = () => {};

/**
 * A generic popup component.
 *
 * @param {Object} props
 * @param {HTMLElement} [props.container]
 * @param {string} [props.className]
 * @param {boolean} [props.delayInitialFocus]
 * @param {{x: number, y: number}} [props.position]
 * @param {number} [props.width]
 * @param {number} [props.height]
 * @param {Function} props.onClose
 * @param {Function} [props.onPostActivate]
 * @param {Function} [props.onPostDeactivate]
 * @param {boolean} [props.returnFocus]
 * @param {boolean} [props.closeOnEscape]
 * @param {string} props.title
 * @param {Ref} [ref]
 */
function PopupComponent(props, globalRef) {
  const {
    container,
    className,
    delayInitialFocus,
    position,
    width,
    height,
    onClose,
    onPostActivate = noop$3,
    onPostDeactivate = noop$3,
    returnFocus = true,
    closeOnEscape = true,
    title
  } = props;
  const focusTrapRef = hooks.useRef(null);
  const localRef = hooks.useRef(null);
  const popupRef = globalRef || localRef;
  const containerNode = hooks.useMemo(() => getContainerNode(container), [container]);
  const handleKeydown = event => {
    // do not allow keyboard events to bubble
    event.stopPropagation();
    if (closeOnEscape && event.key === 'Escape') {
      onClose();
    }
  };

  // re-activate focus trap on focus
  const handleFocus = () => {
    if (focusTrapRef.current) {
      focusTrapRef.current.activate();
    }
  };
  let style = {};
  if (position) {
    style = {
      ...style,
      top: position.top + 'px',
      left: position.left + 'px'
    };
  }
  if (width) {
    style.width = width + 'px';
  }
  if (height) {
    style.height = height + 'px';
  }
  hooks.useEffect(() => {
    if (popupRef.current) {
      popupRef.current.addEventListener('focusin', handleFocus);
    }
    return () => {
      popupRef.current.removeEventListener('focusin', handleFocus);
    };
  }, [popupRef]);
  hooks.useEffect(() => {
    if (popupRef.current) {
      focusTrapRef.current = focusTrap__namespace.createFocusTrap(popupRef.current, {
        clickOutsideDeactivates: true,
        delayInitialFocus,
        fallbackFocus: popupRef.current,
        onPostActivate,
        onPostDeactivate,
        returnFocusOnDeactivate: returnFocus
      });
      focusTrapRef.current.activate();
    }
    return () => focusTrapRef.current && focusTrapRef.current.deactivate();
  }, [popupRef]);
  useEvent('propertiesPanel.detach', onClose);
  return React.createPortal(jsxRuntime.jsx("div", {
    "aria-label": title,
    tabIndex: -1,
    ref: popupRef,
    onKeyDown: handleKeydown,
    role: "dialog",
    class: classnames('bio-properties-panel-popup', className),
    style: style,
    children: props.children
  }), containerNode || document.body);
}
const Popup = React.forwardRef(PopupComponent);
Popup.Title = Title;
Popup.Body = Body;
Popup.Footer = Footer;
function Title(props) {
  const {
    children,
    className,
    draggable,
    emit = () => {},
    title,
    ...rest
  } = props;

  // we can't use state as we need to
  // manipulate this inside dragging events
  const context = hooks.useRef({
    startPosition: null,
    newPosition: null
  });
  const dragPreviewRef = hooks.useRef();
  const titleRef = hooks.useRef();
  const onMove = (event, delta) => {
    cancel(event);
    const {
      x: dx,
      y: dy
    } = delta;
    const newPosition = {
      x: context.current.startPosition.x + dx,
      y: context.current.startPosition.y + dy
    };
    const popupParent = getPopupParent(titleRef.current);
    popupParent.style.top = newPosition.y + 'px';
    popupParent.style.left = newPosition.x + 'px';

    // notify interested parties
    emit('dragover', {
      newPosition,
      delta
    });
  };
  const onMoveStart = event => {
    // initialize drag handler
    const onDragStart = createDragger(onMove, dragPreviewRef.current);
    onDragStart(event);
    event.stopPropagation();
    const popupParent = getPopupParent(titleRef.current);
    const bounds = popupParent.getBoundingClientRect();
    context.current.startPosition = {
      x: bounds.left,
      y: bounds.top
    };

    // notify interested parties
    emit('dragstart');
  };
  const onMoveEnd = () => {
    context.current.newPosition = null;

    // notify interested parties
    emit('dragend');
  };
  return jsxRuntime.jsxs("div", {
    class: classnames('bio-properties-panel-popup__header', draggable && 'draggable', className),
    ref: titleRef,
    draggable: draggable,
    onDragStart: onMoveStart,
    onDragEnd: onMoveEnd,
    ...rest,
    children: [draggable && jsxRuntime.jsxs(jsxRuntime.Fragment, {
      children: [jsxRuntime.jsx("div", {
        ref: dragPreviewRef,
        class: "bio-properties-panel-popup__drag-preview"
      }), jsxRuntime.jsx("div", {
        class: "bio-properties-panel-popup__drag-handle",
        children: jsxRuntime.jsx(DragIcon, {})
      })]
    }), jsxRuntime.jsx("div", {
      class: "bio-properties-panel-popup__title",
      children: title
    }), children]
  });
}
function Body(props) {
  const {
    children,
    className,
    ...rest
  } = props;
  return jsxRuntime.jsx("div", {
    class: classnames('bio-properties-panel-popup__body', className),
    ...rest,
    children: children
  });
}
function Footer(props) {
  const {
    children,
    className,
    ...rest
  } = props;
  return jsxRuntime.jsx("div", {
    class: classnames('bio-properties-panel-popup__footer', className),
    ...rest,
    children: props.children
  });
}

// helpers //////////////////////

function getPopupParent(node) {
  return node.closest('.bio-properties-panel-popup');
}
function cancel(event) {
  event.preventDefault();
  event.stopPropagation();
}
function getContainerNode(node) {
  if (typeof node === 'string') {
    return minDom.query(node);
  }
  return node;
}
const FEEL_POPUP_WIDTH = 700;
const FEEL_POPUP_HEIGHT = 250;

/**
 * FEEL popup component, built as a singleton. Emits lifecycle events as follows:
 *  - `feelPopup.open` - fired before the popup is mounted
 *  - `feelPopup.opened` - fired after the popup is mounted. Event context contains the DOM node of the popup
 *  - `feelPopup.close` - fired before the popup is unmounted. Event context contains the DOM node of the popup
 *  - `feelPopup.closed` - fired after the popup is unmounted
 */
function FEELPopupRoot(props) {
  const {
    element,
    eventBus = {
      fire() {},
      on() {},
      off() {}
    },
    popupContainer
  } = props;
  const prevElement = usePrevious(element);
  const [popupConfig, setPopupConfig] = hooks.useState({});
  const [open, setOpen] = hooks.useState(false);
  const [source, setSource] = hooks.useState(null);
  const [sourceElement, setSourceElement] = hooks.useState(null);
  const emit = (type, context) => {
    eventBus.fire('feelPopup.' + type, context);
  };
  const isOpen = hooks.useCallback(() => {
    return !!open;
  }, [open]);
  useUpdateEffect(() => {
    if (!open) {
      emit('closed');
    }
  }, [open]);
  const handleOpen = (entryId, config, _sourceElement) => {
    setSource(entryId);
    setPopupConfig(config);
    setOpen(true);
    setSourceElement(_sourceElement);
    emit('open');
  };
  const handleClose = (event = {}) => {
    const {
      id
    } = event;
    if (id && id !== source) {
      return;
    }
    setOpen(false);
    setSource(null);
  };
  const feelPopupContext = {
    open: handleOpen,
    close: handleClose,
    source
  };

  // close popup on element change, cf. https://github.com/bpmn-io/properties-panel/issues/270
  hooks.useEffect(() => {
    if (element && prevElement && element !== prevElement) {
      handleClose();
    }
  }, [element]);

  // allow close and open via events
  hooks.useEffect(() => {
    const handlePopupOpen = context => {
      const {
        entryId,
        popupConfig,
        sourceElement
      } = context;
      handleOpen(entryId, popupConfig, sourceElement);
    };
    const handleIsOpen = () => {
      return isOpen();
    };
    eventBus.on('feelPopup._close', handleClose);
    eventBus.on('feelPopup._open', handlePopupOpen);
    eventBus.on('feelPopup._isOpen', handleIsOpen);
    return () => {
      eventBus.off('feelPopup._close', handleClose);
      eventBus.off('feelPopup._open', handleOpen);
      eventBus.off('feelPopup._isOpen', handleIsOpen);
    };
  }, [eventBus, isOpen]);
  return jsxRuntime.jsxs(FeelPopupContext.Provider, {
    value: feelPopupContext,
    children: [open && jsxRuntime.jsx(FeelPopupComponent, {
      onClose: handleClose,
      container: popupContainer,
      sourceElement: sourceElement,
      emit: emit,
      ...popupConfig
    }), props.children]
  });
}
function FeelPopupComponent(props) {
  const {
    container,
    id,
    hostLanguage,
    onInput,
    onClose,
    position,
    singleLine,
    sourceElement,
    title,
    tooltipContainer,
    type,
    value,
    variables,
    emit
  } = props;
  const editorRef = hooks.useRef();
  const popupRef = hooks.useRef();
  const isAutoCompletionOpen = hooks.useRef(false);
  const handleSetReturnFocus = () => {
    sourceElement && sourceElement.focus();
  };
  const onKeyDownCapture = event => {
    // we use capture here to make sure we handle the event before the editor does
    if (event.key === 'Escape') {
      isAutoCompletionOpen.current = autoCompletionOpen(event.target);
    }
  };
  const onKeyDown = event => {
    if (event.key === 'Escape') {
      // close popup only if auto completion is not open
      // we need to do check this because the editor is not
      // stop propagating the keydown event
      // cf. https://discuss.codemirror.net/t/how-can-i-replace-the-default-autocompletion-keymap-v6/3322/5
      if (!isAutoCompletionOpen.current) {
        onClose();
        isAutoCompletionOpen.current = false;
      }
    }
  };
  hooks.useEffect(() => {
    emit('opened', {
      domNode: popupRef.current
    });
    return () => emit('close', {
      domNode: popupRef.current
    });
  }, []);
  hooks.useEffect(() => {
    // Set focus on editor when popup is opened
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [editorRef]);
  return jsxRuntime.jsxs(Popup, {
    container: container,
    className: "bio-properties-panel-feel-popup",
    emit: emit,
    position: position,
    title: title,
    onClose: onClose

    // handle focus manually on deactivate
    ,

    returnFocus: false,
    closeOnEscape: false,
    delayInitialFocus: false,
    onPostDeactivate: handleSetReturnFocus,
    height: FEEL_POPUP_HEIGHT,
    width: FEEL_POPUP_WIDTH,
    ref: popupRef,
    children: [jsxRuntime.jsxs(Popup.Title, {
      title: title,
      emit: emit,
      draggable: true,
      children: [type === 'feel' && jsxRuntime.jsxs("a", {
        href: "https://docs.camunda.io/docs/components/modeler/feel/what-is-feel/",
        target: "_blank",
        class: "bio-properties-panel-feel-popup__title-link",
        children: ["Learn FEEL expressions", jsxRuntime.jsx(HelpIcon, {})]
      }), type === 'feelers' && jsxRuntime.jsxs("a", {
        href: "https://docs.camunda.io/docs/components/modeler/forms/configuration/forms-config-templating-syntax/",
        target: "_blank",
        class: "bio-properties-panel-feel-popup__title-link",
        children: ["Learn templating", jsxRuntime.jsx(HelpIcon, {})]
      })]
    }), jsxRuntime.jsx(Popup.Body, {
      children: jsxRuntime.jsxs("div", {
        onKeyDownCapture: onKeyDownCapture,
        onKeyDown: onKeyDown,
        class: "bio-properties-panel-feel-popup__body",
        children: [type === 'feel' && jsxRuntime.jsx(CodeEditor, {
          enableGutters: true,
          id: prefixId$8(id),
          name: id,
          onInput: onInput,
          value: value,
          variables: variables,
          ref: editorRef,
          tooltipContainer: tooltipContainer
        }), type === 'feelers' && jsxRuntime.jsx(CodeEditor$1, {
          id: prefixId$8(id),
          contentAttributes: {
            'aria-label': title
          },
          enableGutters: true,
          hostLanguage: hostLanguage,
          name: id,
          onInput: onInput,
          value: value,
          ref: editorRef,
          singleLine: singleLine,
          tooltipContainer: tooltipContainer
        })]
      })
    }), jsxRuntime.jsx(Popup.Footer, {
      children: jsxRuntime.jsx("button", {
        type: "button",
        onClick: () => onClose(),
        title: "Close pop-up editor",
        class: "bio-properties-panel-feel-popup__close-btn",
        children: "Close"
      })
    })]
  });
}

// helpers /////////////////

function prefixId$8(id) {
  return `bio-properties-panel-${id}`;
}
function autoCompletionOpen(element) {
  return element.closest('.cm-editor').querySelector('.cm-tooltip-autocomplete');
}

/**
 * This hook behaves like useEffect, but does not trigger on the first render.
 *
 * @param {Function} effect
 * @param {Array} deps
 */
function useUpdateEffect(effect, deps) {
  const isMounted = hooks.useRef(false);
  hooks.useEffect(() => {
    if (isMounted.current) {
      return effect();
    } else {
      isMounted.current = true;
    }
  }, deps);
}
function ToggleSwitch(props) {
  const {
    id,
    label,
    onInput,
    value,
    switcherLabel,
    inline,
    onFocus,
    onBlur,
    inputRef,
    tooltip
  } = props;
  const [localValue, setLocalValue] = hooks.useState(value);
  const handleInputCallback = async () => {
    onInput(!value);
  };
  const handleInput = e => {
    handleInputCallback();
    setLocalValue(e.target.value);
  };
  hooks.useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxRuntime.jsxs("div", {
    class: classnames('bio-properties-panel-toggle-switch', {
      inline
    }),
    children: [jsxRuntime.jsx("label", {
      class: "bio-properties-panel-label",
      for: prefixId$7(id),
      children: jsxRuntime.jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    }), jsxRuntime.jsxs("div", {
      class: "bio-properties-panel-field-wrapper",
      children: [jsxRuntime.jsxs("label", {
        class: "bio-properties-panel-toggle-switch__switcher",
        children: [jsxRuntime.jsx("input", {
          ref: inputRef,
          id: prefixId$7(id),
          class: "bio-properties-panel-input",
          type: "checkbox",
          onFocus: onFocus,
          onBlur: onBlur,
          name: id,
          onInput: handleInput,
          checked: !!localValue
        }), jsxRuntime.jsx("span", {
          class: "bio-properties-panel-toggle-switch__slider"
        })]
      }), switcherLabel && jsxRuntime.jsx("p", {
        class: "bio-properties-panel-toggle-switch__label",
        children: switcherLabel
      })]
    })]
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {String} props.label
 * @param {String} props.switcherLabel
 * @param {Boolean} props.inline
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {string|import('preact').Component} props.tooltip
 */
function ToggleSwitchEntry(props) {
  const {
    element,
    id,
    description,
    label,
    switcherLabel,
    inline,
    getValue,
    setValue,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const value = getValue(element);
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-entry bio-properties-panel-toggle-switch-entry",
    "data-entry-id": id,
    children: [jsxRuntime.jsx(ToggleSwitch, {
      id: id,
      label: label,
      value: value,
      onInput: setValue,
      onFocus: onFocus,
      onBlur: onBlur,
      switcherLabel: switcherLabel,
      inline: inline,
      tooltip: tooltip,
      element: element
    }), jsxRuntime.jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited$8(node) {
  return node && !!node.checked;
}

// helpers /////////////////

function prefixId$7(id) {
  return `bio-properties-panel-${id}`;
}
function NumberField(props) {
  const {
    debounce,
    disabled,
    displayLabel = true,
    id,
    inputRef,
    label,
    max,
    min,
    onInput,
    step,
    value = '',
    onFocus,
    onBlur
  } = props;
  const [localValue, setLocalValue] = hooks.useState(value);
  const handleInputCallback = hooks.useMemo(() => {
    return debounce(target => {
      if (target.validity.valid) {
        onInput(target.value ? parseFloat(target.value) : undefined);
      }
    });
  }, [onInput, debounce]);
  const handleInput = e => {
    handleInputCallback(e.target);
    setLocalValue(e.target.value);
  };
  hooks.useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-numberfield",
    children: [displayLabel && jsxRuntime.jsx("label", {
      for: prefixId$6(id),
      class: "bio-properties-panel-label",
      children: label
    }), jsxRuntime.jsx("input", {
      id: prefixId$6(id),
      ref: inputRef,
      type: "number",
      name: id,
      spellCheck: "false",
      autoComplete: "off",
      disabled: disabled,
      class: "bio-properties-panel-input",
      max: max,
      min: min,
      onInput: handleInput,
      onFocus: onFocus,
      onBlur: onBlur,
      step: step,
      value: localValue
    })]
  });
}

/**
 * @param {Object} props
 * @param {Boolean} props.debounce
 * @param {String} props.description
 * @param {Boolean} props.disabled
 * @param {Object} props.element
 * @param {Function} props.getValue
 * @param {String} props.id
 * @param {String} props.label
 * @param {String} props.max
 * @param {String} props.min
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {String} props.step
 * @param {Function} props.validate
 */
function NumberFieldEntry(props) {
  const {
    debounce,
    description,
    disabled,
    element,
    getValue,
    id,
    label,
    max,
    min,
    setValue,
    step,
    onFocus,
    onBlur,
    validate
  } = props;
  const globalError = useError(id);
  const [localError, setLocalError] = hooks.useState(null);
  let value = getValue(element);
  hooks.useEffect(() => {
    if (minDash.isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setLocalError(newValidationError);
    }
  }, [value, validate]);
  const onInput = newValue => {
    let newValidationError = null;
    if (minDash.isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }
    setValue(newValue, newValidationError);
    setLocalError(newValidationError);
  };
  const error = globalError || localError;
  return jsxRuntime.jsxs("div", {
    class: classnames('bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [jsxRuntime.jsx(NumberField, {
      debounce: debounce,
      disabled: disabled,
      id: id,
      label: label,
      onFocus: onFocus,
      onBlur: onBlur,
      onInput: onInput,
      max: max,
      min: min,
      step: step,
      value: value
    }, element), error && jsxRuntime.jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsxRuntime.jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited$7(node) {
  return node && !!node.value;
}

// helpers /////////////////

function prefixId$6(id) {
  return `bio-properties-panel-${id}`;
}
const noop$2 = () => {};
function FeelTextfieldComponent(props) {
  const {
    debounce,
    id,
    element,
    label,
    hostLanguage,
    onInput,
    onError,
    feel,
    value = '',
    disabled = false,
    variables,
    singleLine,
    tooltipContainer,
    OptionalComponent = OptionalFeelInput,
    tooltip
  } = props;
  const [localValue, _setLocalValue] = hooks.useState(value);
  const editorRef = useShowEntryEvent(id);
  const containerRef = hooks.useRef();
  const feelActive = minDash.isString(localValue) && localValue.startsWith('=') || feel === 'required';
  const feelOnlyValue = minDash.isString(localValue) && localValue.startsWith('=') ? localValue.substring(1) : localValue;
  const [focus, _setFocus] = hooks.useState(undefined);
  const {
    open: openPopup,
    source: popupSource
  } = hooks.useContext(FeelPopupContext);
  const popuOpen = popupSource === id;
  const setFocus = (offset = 0) => {
    const hasFocus = containerRef.current.contains(document.activeElement);

    // Keep caret position if it is already focused, otherwise focus at the end
    const position = hasFocus ? document.activeElement.selectionStart : Infinity;
    _setFocus(position + offset);
  };
  const handleInputCallback = hooks.useMemo(() => {
    return debounce(newValue => {
      onInput(newValue);
    });
  }, [onInput, debounce]);
  const setLocalValue = newValue => {
    _setLocalValue(newValue);
    if (typeof newValue === 'undefined' || newValue === '' || newValue === '=') {
      handleInputCallback(undefined);
    } else {
      handleInputCallback(newValue);
    }
  };
  const handleFeelToggle = useStaticCallback(() => {
    if (feel === 'required') {
      return;
    }
    if (!feelActive) {
      setLocalValue('=' + localValue);
    } else {
      setLocalValue(feelOnlyValue);
    }
  });
  const handleLocalInput = newValue => {
    if (feelActive) {
      newValue = '=' + newValue;
    }
    if (newValue === localValue) {
      return;
    }
    setLocalValue(newValue);
    if (!feelActive && minDash.isString(newValue) && newValue.startsWith('=')) {
      // focus is behind `=` sign that will be removed
      setFocus(-1);
    }
  };
  const handleLint = useStaticCallback(lint => {
    if (!(lint && lint.length)) {
      onError(undefined);
      return;
    }
    onError('Unparsable FEEL expression.');
  });
  const handlePopupOpen = (type = 'feel') => {
    const popupOptions = {
      id,
      hostLanguage,
      onInput: handleLocalInput,
      position: calculatePopupPosition(containerRef.current),
      singleLine,
      title: getPopupTitle(element, label),
      tooltipContainer,
      type,
      value: feelOnlyValue,
      variables
    };
    openPopup(id, popupOptions, editorRef.current);
  };
  hooks.useEffect(() => {
    if (typeof focus !== 'undefined') {
      editorRef.current.focus(focus);
      _setFocus(undefined);
    }
  }, [focus]);
  hooks.useEffect(() => {
    if (value === localValue) {
      return;
    }

    // External value change removed content => keep FEEL configuration
    if (!value) {
      setLocalValue(feelActive ? '=' : '');
      return;
    }
    setLocalValue(value);
  }, [value]);

  // copy-paste integration
  hooks.useEffect(() => {
    const copyHandler = event => {
      if (!feelActive) {
        return;
      }
      event.clipboardData.setData('application/FEEL', event.clipboardData.getData('text'));
    };
    const pasteHandler = event => {
      if (feelActive || popuOpen) {
        return;
      }
      const data = event.clipboardData.getData('application/FEEL');
      if (data) {
        setTimeout(() => {
          handleFeelToggle();
          setFocus();
        });
      }
    };
    containerRef.current.addEventListener('copy', copyHandler);
    containerRef.current.addEventListener('cut', copyHandler);
    containerRef.current.addEventListener('paste', pasteHandler);
    return () => {
      containerRef.current.removeEventListener('copy', copyHandler);
      containerRef.current.removeEventListener('cut', copyHandler);
      containerRef.current.removeEventListener('paste', pasteHandler);
    };
  }, [containerRef, feelActive, handleFeelToggle, setFocus]);
  return jsxRuntime.jsxs("div", {
    class: classnames('bio-properties-panel-feel-entry', {
      'feel-active': feelActive
    }),
    children: [jsxRuntime.jsxs("label", {
      for: prefixId$5(id),
      class: "bio-properties-panel-label",
      onClick: () => setFocus(),
      children: [jsxRuntime.jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      }), jsxRuntime.jsx(FeelIcon, {
        label: label,
        feel: feel,
        onClick: handleFeelToggle,
        active: feelActive
      })]
    }), jsxRuntime.jsxs("div", {
      class: "bio-properties-panel-feel-container",
      ref: containerRef,
      children: [jsxRuntime.jsx(FeelIndicator, {
        active: feelActive,
        disabled: feel !== 'optional' || disabled,
        onClick: handleFeelToggle
      }), feelActive ? jsxRuntime.jsx(CodeEditor, {
        id: prefixId$5(id),
        name: id,
        onInput: handleLocalInput,
        disabled: disabled,
        popupOpen: popuOpen,
        onFeelToggle: () => {
          handleFeelToggle();
          setFocus(true);
        },
        onLint: handleLint,
        onPopupOpen: handlePopupOpen,
        value: feelOnlyValue,
        variables: variables,
        ref: editorRef,
        tooltipContainer: tooltipContainer
      }) : jsxRuntime.jsx(OptionalComponent, {
        ...props,
        popupOpen: popuOpen,
        onInput: handleLocalInput,
        contentAttributes: {
          'id': prefixId$5(id),
          'aria-label': label
        },
        value: localValue,
        ref: editorRef,
        onPopupOpen: handlePopupOpen,
        containerRef: containerRef
      })]
    })]
  });
}
const FeelTextfield = withAutoClosePopup(FeelTextfieldComponent);
const OptionalFeelInput = React.forwardRef((props, ref) => {
  const {
    id,
    disabled,
    onInput,
    value,
    onFocus,
    onBlur
  } = props;
  const inputRef = hooks.useRef();

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: position => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      if (typeof position === 'number') {
        if (position > value.length) {
          position = value.length;
        }
        input.setSelectionRange(position, position);
      }
    }
  };
  return jsxRuntime.jsx("input", {
    id: prefixId$5(id),
    type: "text",
    ref: inputRef,
    name: id,
    spellCheck: "false",
    autoComplete: "off",
    disabled: disabled,
    class: "bio-properties-panel-input",
    onInput: e => onInput(e.target.value),
    onFocus: onFocus,
    onBlur: onBlur,
    value: value || ''
  });
});
const OptionalFeelNumberField = React.forwardRef((props, ref) => {
  const {
    id,
    debounce,
    disabled,
    onInput,
    value,
    min,
    max,
    step,
    onFocus,
    onBlur
  } = props;
  const inputRef = hooks.useRef();

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: position => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      if (typeof position === 'number' && position !== Infinity) {
        if (position > value.length) {
          position = value.length;
        }
        input.setSelectionRange(position, position);
      }
    }
  };
  return jsxRuntime.jsx(NumberField, {
    id: id,
    debounce: debounce,
    disabled: disabled,
    displayLabel: false,
    inputRef: inputRef,
    max: max,
    min: min,
    onInput: onInput,
    step: step,
    value: value,
    onFocus: onFocus,
    onBlur: onBlur
  });
});
React.forwardRef((props, ref) => {
  const {
    id,
    disabled,
    onInput,
    value,
    onFocus,
    onBlur
  } = props;
  const inputRef = hooks.useRef();

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: () => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.setSelectionRange(0, 0);
    }
  };
  return jsxRuntime.jsx("textarea", {
    id: prefixId$5(id),
    type: "text",
    ref: inputRef,
    name: id,
    spellCheck: "false",
    autoComplete: "off",
    disabled: disabled,
    class: "bio-properties-panel-input",
    onInput: e => onInput(e.target.value),
    onFocus: onFocus,
    onBlur: onBlur,
    value: value || '',
    "data-gramm": "false"
  });
});
const OptionalFeelToggleSwitch = React.forwardRef((props, ref) => {
  const {
    id,
    onInput,
    value,
    onFocus,
    onBlur,
    switcherLabel
  } = props;
  const inputRef = hooks.useRef();

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: () => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
    }
  };
  return jsxRuntime.jsx(ToggleSwitch, {
    id: id,
    value: value,
    inputRef: inputRef,
    onInput: onInput,
    onFocus: onFocus,
    onBlur: onBlur,
    switcherLabel: switcherLabel
  });
});
React.forwardRef((props, ref) => {
  const {
    id,
    disabled,
    onInput,
    value,
    onFocus,
    onBlur
  } = props;
  const inputRef = hooks.useRef();
  const handleChange = ({
    target
  }) => {
    onInput(target.checked);
  };

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: () => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
    }
  };
  return jsxRuntime.jsx("input", {
    ref: inputRef,
    id: prefixId$5(id),
    name: id,
    onFocus: onFocus,
    onBlur: onBlur,
    type: "checkbox",
    class: "bio-properties-panel-input",
    onChange: handleChange,
    checked: value,
    disabled: disabled
  });
});

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {Boolean} props.feel
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.tooltipContainer
 * @param {Function} props.validate
 * @param {Function} props.show
 * @param {Function} props.example
 * @param {Function} props.variables
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {string|import('preact').Component} props.tooltip
 */
function FeelEntry(props) {
  const {
    element,
    id,
    description,
    debounce,
    disabled,
    feel,
    label,
    getValue,
    setValue,
    tooltipContainer,
    hostLanguage,
    singleLine,
    validate,
    show = noop$2,
    example,
    variables,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const [validationError, setValidationError] = hooks.useState(null);
  const [localError, setLocalError] = hooks.useState(null);
  let value = getValue(element);
  hooks.useEffect(() => {
    if (minDash.isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setValidationError(newValidationError);
    }
  }, [value, validate]);
  const onInput = useStaticCallback(newValue => {
    let newValidationError = null;
    if (minDash.isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }

    // don't create multiple commandStack entries for the same value
    if (newValue !== value) {
      setValue(newValue, newValidationError);
    }
    setValidationError(newValidationError);
  });
  const onError = hooks.useCallback(err => {
    setLocalError(err);
  }, []);
  const temporaryError = useError(id);
  const error = temporaryError || localError || validationError;
  return jsxRuntime.jsxs("div", {
    class: classnames(props.class, 'bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [preact.createElement(FeelTextfield, {
      ...props,
      debounce: debounce,
      disabled: disabled,
      feel: feel,
      id: id,
      key: element,
      label: label,
      onInput: onInput,
      onError: onError,
      onFocus: onFocus,
      onBlur: onBlur,
      example: example,
      hostLanguage: hostLanguage,
      singleLine: singleLine,
      show: show,
      value: value,
      variables: variables,
      tooltipContainer: tooltipContainer,
      OptionalComponent: props.OptionalComponent,
      tooltip: tooltip
    }), error && jsxRuntime.jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsxRuntime.jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {String} props.max
 * @param {String} props.min
 * @param {String} props.step
 * @param {Boolean} props.feel
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.tooltipContainer
 * @param {Function} props.validate
 * @param {Function} props.show
 * @param {Function} props.example
 * @param {Function} props.variables
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 */
function FeelNumberEntry(props) {
  return jsxRuntime.jsx(FeelEntry, {
    class: "bio-properties-panel-feel-number",
    OptionalComponent: OptionalFeelNumberField,
    ...props
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {Boolean} props.feel
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.tooltipContainer
 * @param {Function} props.validate
 * @param {Function} props.show
 * @param {Function} props.example
 * @param {Function} props.variables
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 */
function FeelToggleSwitchEntry(props) {
  return jsxRuntime.jsx(FeelEntry, {
    class: "bio-properties-panel-feel-toggle-switch",
    OptionalComponent: OptionalFeelToggleSwitch,
    ...props
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {String} props.hostLanguage
 * @param {Boolean} props.singleLine
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {Boolean} props.feel
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.tooltipContainer
 * @param {Function} props.validate
 * @param {Function} props.show
 * @param {Function} props.example
 * @param {Function} props.variables
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 */
function FeelTemplatingEntry(props) {
  return jsxRuntime.jsx(FeelEntry, {
    class: "bio-properties-panel-feel-templating",
    OptionalComponent: CodeEditor$1,
    ...props
  });
}
function isEdited$6(node) {
  if (!node) {
    return false;
  }
  if (node.type === 'checkbox') {
    return !!node.checked || node.classList.contains('edited');
  }
  return !!node.value || node.classList.contains('edited');
}

// helpers /////////////////

function prefixId$5(id) {
  return `bio-properties-panel-${id}`;
}
function calculatePopupPosition(element) {
  const {
    top,
    left
  } = element.getBoundingClientRect();
  return {
    left: left - FEEL_POPUP_WIDTH - 20,
    top: top
  };
}

// todo(pinussilvestrus): make this configurable in the future
function getPopupTitle(element, label) {
  let popupTitle = '';
  if (element && element.type) {
    popupTitle = `${element.type} / `;
  }
  return `${popupTitle}${label}`;
}
function withAutoClosePopup(Component) {
  return function (props) {
    const {
      id
    } = props;
    const {
      close
    } = hooks.useContext(FeelPopupContext);
    const closePopup = useStaticCallback(close);
    hooks.useEffect(() => {
      return () => {
        closePopup({
          id
        });
      };
    }, []);
    return jsxRuntime.jsx(Component, {
      ...props
    });
  };
}
const DEFAULT_LAYOUT = {};
const DEFAULT_DESCRIPTION = {};
const DEFAULT_TOOLTIP = {};

/**
 * @typedef { {
 *    component: import('preact').Component,
 *    id: String,
 *    isEdited?: Function
 * } } EntryDefinition
 *
 * @typedef { {
 *    autoFocusEntry: String,
 *    autoOpen?: Boolean,
 *    entries: Array<EntryDefinition>,
 *    id: String,
 *    label: String,
 *    remove: (event: MouseEvent) => void
 * } } ListItemDefinition
 *
 * @typedef { {
 *    add: (event: MouseEvent) => void,
 *    component: import('preact').Component,
 *    element: Object,
 *    id: String,
 *    items: Array<ListItemDefinition>,
 *    label: String,
 *    shouldSort?: Boolean,
 *    shouldOpen?: Boolean
 * } } ListGroupDefinition
 *
 * @typedef { {
 *    component?: import('preact').Component,
 *    entries: Array<EntryDefinition>,
 *    id: String,
 *    label: String,
 *    shouldOpen?: Boolean
 * } } GroupDefinition
 *
 *  @typedef { {
 *    [id: String]: GetDescriptionFunction
 * } } DescriptionConfig
 *
 *  @typedef { {
 *    [id: String]: GetTooltipFunction
 * } } TooltipConfig
 *
 * @callback { {
 * @param {string} id
 * @param {Object} element
 * @returns {string}
 * } } GetDescriptionFunction
 *
 * @callback { {
 * @param {string} id
 * @param {Object} element
 * @returns {string}
 * } } GetTooltipFunction
 *
 * @typedef { {
 *  getEmpty: (element: object) => import('./components/Placeholder').PlaceholderDefinition,
 *  getMultiple: (element: Object) => import('./components/Placeholder').PlaceholderDefinition
 * } } PlaceholderProvider
 *
 */

/**
 * A basic properties panel component. Describes *how* content will be rendered, accepts
 * data from implementor to describe *what* will be rendered.
 *
 * @param {Object} props
 * @param {Object|Array} props.element
 * @param {import('./components/Header').HeaderProvider} props.headerProvider
 * @param {PlaceholderProvider} [props.placeholderProvider]
 * @param {Array<GroupDefinition|ListGroupDefinition>} props.groups
 * @param {Object} [props.layoutConfig]
 * @param {Function} [props.layoutChanged]
 * @param {DescriptionConfig} [props.descriptionConfig]
 * @param {Function} [props.descriptionLoaded]
 * @param {TooltipConfig} [props.tooltipConfig]
 * @param {Function} [props.tooltipLoaded]
 * @param {HTMLElement} [props.feelPopupContainer]
 * @param {Object} [props.eventBus]
 */
function PropertiesPanel$1(props) {
  const {
    element,
    headerProvider,
    placeholderProvider,
    groups,
    layoutConfig,
    layoutChanged,
    descriptionConfig,
    descriptionLoaded,
    tooltipConfig,
    tooltipLoaded,
    feelPopupContainer,
    eventBus
  } = props;

  // set-up layout context
  const [layout, setLayout] = hooks.useState(createLayout(layoutConfig));

  // react to external changes in the layout config
  useUpdateLayoutEffect(() => {
    const newLayout = createLayout(layoutConfig);
    setLayout(newLayout);
  }, [layoutConfig]);
  hooks.useEffect(() => {
    if (typeof layoutChanged === 'function') {
      layoutChanged(layout);
    }
  }, [layout, layoutChanged]);
  const getLayoutForKey = (key, defaultValue) => {
    return minDash.get(layout, key, defaultValue);
  };
  const setLayoutForKey = (key, config) => {
    const newLayout = minDash.assign({}, layout);
    minDash.set(newLayout, key, config);
    setLayout(newLayout);
  };
  const layoutContext = {
    layout,
    setLayout,
    getLayoutForKey,
    setLayoutForKey
  };

  // set-up description context
  const description = hooks.useMemo(() => createDescriptionContext(descriptionConfig), [descriptionConfig]);
  hooks.useEffect(() => {
    if (typeof descriptionLoaded === 'function') {
      descriptionLoaded(description);
    }
  }, [description, descriptionLoaded]);
  const getDescriptionForId = (id, element) => {
    return description[id] && description[id](element);
  };
  const descriptionContext = {
    description,
    getDescriptionForId
  };

  // set-up tooltip context
  const tooltip = hooks.useMemo(() => createTooltipContext(tooltipConfig), [tooltipConfig]);
  hooks.useEffect(() => {
    if (typeof tooltipLoaded === 'function') {
      tooltipLoaded(tooltip);
    }
  }, [tooltip, tooltipLoaded]);
  const getTooltipForId = (id, element) => {
    return tooltip[id] && tooltip[id](element);
  };
  const tooltipContext = {
    tooltip,
    getTooltipForId
  };
  const [errors, setErrors] = hooks.useState({});
  const onSetErrors = ({
    errors
  }) => setErrors(errors);
  useEvent('propertiesPanel.setErrors', onSetErrors, eventBus);
  const errorsContext = {
    errors
  };
  const eventContext = {
    eventBus
  };
  const propertiesPanelContext = {
    element
  };

  // empty state
  if (placeholderProvider && !element) {
    return jsxRuntime.jsx(Placeholder, {
      ...placeholderProvider.getEmpty()
    });
  }

  // multiple state
  if (placeholderProvider && minDash.isArray(element)) {
    return jsxRuntime.jsx(Placeholder, {
      ...placeholderProvider.getMultiple()
    });
  }
  return jsxRuntime.jsx(LayoutContext.Provider, {
    value: propertiesPanelContext,
    children: jsxRuntime.jsx(ErrorsContext.Provider, {
      value: errorsContext,
      children: jsxRuntime.jsx(DescriptionContext.Provider, {
        value: descriptionContext,
        children: jsxRuntime.jsx(TooltipContext.Provider, {
          value: tooltipContext,
          children: jsxRuntime.jsx(LayoutContext.Provider, {
            value: layoutContext,
            children: jsxRuntime.jsx(EventContext.Provider, {
              value: eventContext,
              children: jsxRuntime.jsx(FEELPopupRoot, {
                element: element,
                eventBus: eventBus,
                popupContainer: feelPopupContainer,
                children: jsxRuntime.jsxs("div", {
                  class: "bio-properties-panel",
                  children: [jsxRuntime.jsx(Header, {
                    element: element,
                    headerProvider: headerProvider
                  }), jsxRuntime.jsx("div", {
                    class: "bio-properties-panel-scroll-container",
                    children: groups.map(group => {
                      const {
                        component: Component = Group,
                        id
                      } = group;
                      return preact.createElement(Component, {
                        ...group,
                        key: id,
                        element: element
                      });
                    })
                  })]
                })
              })
            })
          })
        })
      })
    })
  });
}

// helpers //////////////////

function createLayout(overrides = {}, defaults = DEFAULT_LAYOUT) {
  return {
    ...defaults,
    ...overrides
  };
}
function createDescriptionContext(overrides = {}) {
  return {
    ...DEFAULT_DESCRIPTION,
    ...overrides
  };
}
function createTooltipContext(overrides = {}) {
  return {
    ...DEFAULT_TOOLTIP,
    ...overrides
  };
}

// hooks //////////////////

/**
 * This hook behaves like useLayoutEffect, but does not trigger on the first render.
 *
 * @param {Function} effect
 * @param {Array} deps
 */
function useUpdateLayoutEffect(effect, deps) {
  const isMounted = hooks.useRef(false);
  hooks.useLayoutEffect(() => {
    if (isMounted.current) {
      return effect();
    } else {
      isMounted.current = true;
    }
  }, deps);
}
function CollapsibleEntry(props) {
  const {
    element,
    entries = [],
    id,
    label,
    open: shouldOpen,
    remove
  } = props;
  const [open, setOpen] = hooks.useState(shouldOpen);
  const toggleOpen = () => setOpen(!open);
  const {
    onShow
  } = hooks.useContext(LayoutContext);
  const propertiesPanelContext = {
    ...hooks.useContext(LayoutContext),
    onShow: hooks.useCallback(() => {
      setOpen(true);
      if (minDash.isFunction(onShow)) {
        onShow();
      }
    }, [onShow, setOpen])
  };

  // todo(pinussilvestrus): translate once we have a translate mechanism for the core
  const placeholderLabel = '<empty>';
  return jsxRuntime.jsxs("div", {
    "data-entry-id": id,
    class: classnames('bio-properties-panel-collapsible-entry', open ? 'open' : ''),
    children: [jsxRuntime.jsxs("div", {
      class: "bio-properties-panel-collapsible-entry-header",
      onClick: toggleOpen,
      children: [jsxRuntime.jsx("div", {
        title: label || placeholderLabel,
        class: classnames('bio-properties-panel-collapsible-entry-header-title', !label && 'empty'),
        children: label || placeholderLabel
      }), jsxRuntime.jsx("button", {
        type: "button",
        title: "Toggle list item",
        class: "bio-properties-panel-arrow  bio-properties-panel-collapsible-entry-arrow",
        children: jsxRuntime.jsx(ArrowIcon, {
          class: open ? 'bio-properties-panel-arrow-down' : 'bio-properties-panel-arrow-right'
        })
      }), remove ? jsxRuntime.jsx("button", {
        type: "button",
        title: "Delete item",
        class: "bio-properties-panel-remove-entry",
        onClick: remove,
        children: jsxRuntime.jsx(DeleteIcon, {})
      }) : null]
    }), jsxRuntime.jsx("div", {
      class: classnames('bio-properties-panel-collapsible-entry-entries', open ? 'open' : ''),
      children: jsxRuntime.jsx(LayoutContext.Provider, {
        value: propertiesPanelContext,
        children: entries.map(entry => {
          const {
            component: Component,
            id
          } = entry;
          return preact.createElement(Component, {
            ...entry,
            element: element,
            key: id
          });
        })
      })
    })]
  });
}
function ListItem(props) {
  const {
    autoFocusEntry,
    autoOpen
  } = props;

  // focus specified entry on auto open
  hooks.useEffect(() => {
    if (autoOpen && autoFocusEntry) {
      const entry = minDom.query(`[data-entry-id="${autoFocusEntry}"]`);
      const focusableInput = minDom.query('.bio-properties-panel-input', entry);
      if (focusableInput) {
        if (minDash.isFunction(focusableInput.select)) {
          focusableInput.select();
        } else if (minDash.isFunction(focusableInput.focus)) {
          focusableInput.focus();
        }
      }
    }
  }, [autoOpen, autoFocusEntry]);
  return jsxRuntime.jsx("div", {
    class: "bio-properties-panel-list-item",
    children: jsxRuntime.jsx(CollapsibleEntry, {
      ...props,
      open: autoOpen
    })
  });
}
const noop$1 = () => {};

/**
 * @param {import('../PropertiesPanel').ListGroupDefinition} props
 */
function ListGroup(props) {
  const {
    add,
    element,
    id,
    items,
    label,
    shouldOpen = true,
    shouldSort = true
  } = props;
  const groupRef = hooks.useRef(null);
  const [open, setOpen] = useLayoutState(['groups', id, 'open'], false);
  const [sticky, setSticky] = hooks.useState(false);
  const onShow = hooks.useCallback(() => setOpen(true), [setOpen]);
  const [ordering, setOrdering] = hooks.useState([]);
  const [newItemAdded, setNewItemAdded] = hooks.useState(false);

  // Flag to mark that add button was clicked in the last render cycle
  const [addTriggered, setAddTriggered] = hooks.useState(false);
  const prevItems = usePrevious(items);
  const prevElement = usePrevious(element);
  const elementChanged = element !== prevElement;
  const shouldHandleEffects = !elementChanged && (shouldSort || shouldOpen);

  // reset initial ordering when element changes (before first render)
  if (elementChanged) {
    setOrdering(createOrdering(shouldSort ? sortItems(items) : items));
  }

  // keep ordering in sync to items - and open changes

  // (0) set initial ordering from given items
  hooks.useEffect(() => {
    if (!prevItems || !shouldSort) {
      setOrdering(createOrdering(items));
    }
  }, [items, element]);

  // (1) items were added
  hooks.useEffect(() => {
    // reset addTriggered flag
    setAddTriggered(false);
    if (shouldHandleEffects && prevItems && items.length > prevItems.length) {
      let add = [];
      items.forEach(item => {
        if (!ordering.includes(item.id)) {
          add.push(item.id);
        }
      });
      let newOrdering = ordering;

      // open if not open, configured and triggered by add button
      //
      // TODO(marstamm): remove once we refactor layout handling for listGroups.
      // Ideally, opening should be handled as part of the `add` callback and
      // not be a concern for the ListGroup component.
      if (addTriggered && !open && shouldOpen) {
        toggleOpen();
      }

      // filter when not open and configured
      if (!open && shouldSort) {
        newOrdering = createOrdering(sortItems(items));
      }

      // add new items on top or bottom depending on sorting behavior
      newOrdering = newOrdering.filter(item => !add.includes(item));
      if (shouldSort) {
        newOrdering.unshift(...add);
      } else {
        newOrdering.push(...add);
      }
      setOrdering(newOrdering);
      setNewItemAdded(addTriggered);
    } else {
      setNewItemAdded(false);
    }
  }, [items, open, shouldHandleEffects, addTriggered]);

  // (2) sort items on open if shouldSort is set
  hooks.useEffect(() => {
    if (shouldSort && open && !newItemAdded) {
      setOrdering(createOrdering(sortItems(items)));
    }
  }, [open, shouldSort]);

  // (3) items were deleted
  hooks.useEffect(() => {
    if (shouldHandleEffects && prevItems && items.length < prevItems.length) {
      let keep = [];
      ordering.forEach(o => {
        if (getItem(items, o)) {
          keep.push(o);
        }
      });
      setOrdering(keep);
    }
  }, [items, shouldHandleEffects]);

  // set css class when group is sticky to top
  useStickyIntersectionObserver(groupRef, 'div.bio-properties-panel-scroll-container', setSticky);
  const toggleOpen = () => setOpen(!open);
  const hasItems = !!items.length;
  const propertiesPanelContext = {
    ...hooks.useContext(LayoutContext),
    onShow
  };
  const handleAddClick = e => {
    setAddTriggered(true);
    add(e);
  };
  const allErrors = useErrors();
  const hasError = items.some(item => {
    if (allErrors[item.id]) {
      return true;
    }
    if (!item.entries) {
      return;
    }

    // also check if the error is nested, e.g. for name-value entries
    return item.entries.some(entry => allErrors[entry.id]);
  });
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-group",
    "data-group-id": 'group-' + id,
    ref: groupRef,
    children: [jsxRuntime.jsxs("div", {
      class: classnames('bio-properties-panel-group-header', hasItems ? '' : 'empty', hasItems && open ? 'open' : '', sticky && open ? 'sticky' : ''),
      onClick: hasItems ? toggleOpen : noop$1,
      children: [jsxRuntime.jsx("div", {
        title: props.tooltip ? null : label,
        "data-title": label,
        class: "bio-properties-panel-group-header-title",
        children: jsxRuntime.jsx(TooltipWrapper, {
          value: props.tooltip,
          forId: 'group-' + id,
          element: element,
          parent: groupRef,
          children: label
        })
      }), jsxRuntime.jsxs("div", {
        class: "bio-properties-panel-group-header-buttons",
        children: [add ? jsxRuntime.jsxs("button", {
          type: "button",
          title: "Create new list item",
          class: "bio-properties-panel-group-header-button bio-properties-panel-add-entry",
          onClick: handleAddClick,
          children: [jsxRuntime.jsx(CreateIcon, {}), !hasItems ? jsxRuntime.jsx("span", {
            class: "bio-properties-panel-add-entry-label",
            children: "Create"
          }) : null]
        }) : null, hasItems ? jsxRuntime.jsx("div", {
          title: `List contains ${items.length} item${items.length != 1 ? 's' : ''}`,
          class: classnames('bio-properties-panel-list-badge', hasError ? 'bio-properties-panel-list-badge--error' : ''),
          children: items.length
        }) : null, hasItems ? jsxRuntime.jsx("button", {
          type: "button",
          title: "Toggle section",
          class: "bio-properties-panel-group-header-button bio-properties-panel-arrow",
          children: jsxRuntime.jsx(ArrowIcon, {
            class: open ? 'bio-properties-panel-arrow-down' : 'bio-properties-panel-arrow-right'
          })
        }) : null]
      })]
    }), jsxRuntime.jsx("div", {
      class: classnames('bio-properties-panel-list', open && hasItems ? 'open' : ''),
      children: jsxRuntime.jsx(LayoutContext.Provider, {
        value: propertiesPanelContext,
        children: ordering.map((o, index) => {
          const item = getItem(items, o);
          if (!item) {
            return;
          }
          const {
            id
          } = item;

          // if item was added, open it
          // Existing items will not be affected as autoOpen is only applied on first render
          const autoOpen = newItemAdded;
          return preact.createElement(ListItem, {
            ...item,
            autoOpen: autoOpen,
            element: element,
            index: index,
            key: id
          });
        })
      })
    })]
  });
}

// helpers ////////////////////

/**
 * Sorts given items alphanumeric by label
 */
function sortItems(items) {
  return minDash.sortBy(items, i => i.label.toLowerCase());
}
function getItem(items, id) {
  return minDash.find(items, i => i.id === id);
}
function createOrdering(items) {
  return items.map(i => i.id);
}
function Checkbox(props) {
  const {
    id,
    label,
    onChange,
    disabled,
    value = false,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const [localValue, setLocalValue] = hooks.useState(value);
  const handleChangeCallback = ({
    target
  }) => {
    onChange(target.checked);
  };
  const handleChange = e => {
    handleChangeCallback(e);
    setLocalValue(e.target.value);
  };
  hooks.useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  const ref = useShowEntryEvent(id);
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-checkbox",
    children: [jsxRuntime.jsx("input", {
      ref: ref,
      id: prefixId$4(id),
      name: id,
      onFocus: onFocus,
      onBlur: onBlur,
      type: "checkbox",
      class: "bio-properties-panel-input",
      onChange: handleChange,
      checked: localValue,
      disabled: disabled
    }), jsxRuntime.jsx("label", {
      for: prefixId$4(id),
      class: "bio-properties-panel-label",
      children: jsxRuntime.jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    })]
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {string|import('preact').Component} props.tooltip
 * @param {boolean} [props.disabled]
 */
function CheckboxEntry(props) {
  const {
    element,
    id,
    description,
    label,
    getValue,
    setValue,
    disabled,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const value = getValue(element);
  const error = useError(id);
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-entry bio-properties-panel-checkbox-entry",
    "data-entry-id": id,
    children: [jsxRuntime.jsx(Checkbox, {
      disabled: disabled,
      id: id,
      label: label,
      onChange: setValue,
      onFocus: onFocus,
      onBlur: onBlur,
      value: value,
      tooltip: tooltip,
      element: element
    }, element), error && jsxRuntime.jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsxRuntime.jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited$5(node) {
  return node && !!node.checked;
}

// helpers /////////////////

function prefixId$4(id) {
  return `bio-properties-panel-${id}`;
}
function Select(props) {
  const {
    id,
    label,
    onChange,
    options = [],
    value = '',
    disabled,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const ref = useShowEntryEvent(id);
  const [localValue, setLocalValue] = hooks.useState(value);
  const handleChangeCallback = ({
    target
  }) => {
    onChange(target.value);
  };
  const handleChange = e => {
    handleChangeCallback(e);
    setLocalValue(e.target.value);
  };
  hooks.useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-select",
    children: [jsxRuntime.jsx("label", {
      for: prefixId$3(id),
      class: "bio-properties-panel-label",
      children: jsxRuntime.jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    }), jsxRuntime.jsx("select", {
      ref: ref,
      id: prefixId$3(id),
      name: id,
      class: "bio-properties-panel-input",
      onInput: handleChange,
      onFocus: onFocus,
      onBlur: onBlur,
      value: localValue,
      disabled: disabled,
      children: options.map((option, idx) => {
        if (option.children) {
          return jsxRuntime.jsx("optgroup", {
            label: option.label,
            children: option.children.map((child, idx) => jsxRuntime.jsx("option", {
              value: child.value,
              disabled: child.disabled,
              children: child.label
            }, idx))
          }, idx);
        }
        return jsxRuntime.jsx("option", {
          value: option.value,
          disabled: option.disabled,
          children: option.label
        }, idx);
      })
    })]
  });
}

/**
 * @param {object} props
 * @param {object} props.element
 * @param {string} props.id
 * @param {string} [props.description]
 * @param {string} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {Function} props.getOptions
 * @param {boolean} [props.disabled]
 * @param {Function} [props.validate]
 * @param {string|import('preact').Component} props.tooltip
 */
function SelectEntry(props) {
  const {
    element,
    id,
    description,
    label,
    getValue,
    setValue,
    getOptions,
    disabled,
    onFocus,
    onBlur,
    validate,
    tooltip
  } = props;
  const options = getOptions(element);
  const globalError = useError(id);
  const [localError, setLocalError] = hooks.useState(null);
  let value = getValue(element);
  hooks.useEffect(() => {
    if (minDash.isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setLocalError(newValidationError);
    }
  }, [value, validate]);
  const onChange = newValue => {
    let newValidationError = null;
    if (minDash.isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }
    setValue(newValue, newValidationError);
    setLocalError(newValidationError);
  };
  const error = globalError || localError;
  return jsxRuntime.jsxs("div", {
    class: classnames('bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [jsxRuntime.jsx(Select, {
      id: id,
      label: label,
      value: value,
      onChange: onChange,
      onFocus: onFocus,
      onBlur: onBlur,
      options: options,
      disabled: disabled,
      tooltip: tooltip,
      element: element
    }, element), error && jsxRuntime.jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsxRuntime.jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited$3(node) {
  return node && !!node.value;
}

// helpers /////////////////

function prefixId$3(id) {
  return `bio-properties-panel-${id}`;
}
function resizeToContents(element) {
  element.style.height = 'auto';

  // a 2px pixel offset is required to prevent scrollbar from
  // appearing on OS with a full length scroll bar (Windows/Linux)
  element.style.height = `${element.scrollHeight + 2}px`;
}
function TextArea(props) {
  const {
    id,
    label,
    debounce,
    onInput,
    value = '',
    disabled,
    monospace,
    onFocus,
    onBlur,
    autoResize,
    rows = autoResize ? 1 : 2,
    tooltip
  } = props;
  const [localValue, setLocalValue] = hooks.useState(value);
  const ref = useShowEntryEvent(id);
  const handleInputCallback = hooks.useMemo(() => {
    return debounce(target => onInput(target.value.length ? target.value : undefined));
  }, [onInput, debounce]);
  const handleInput = e => {
    handleInputCallback(e.target);
    autoResize && resizeToContents(e.target);
    setLocalValue(e.target.value);
  };
  hooks.useLayoutEffect(() => {
    autoResize && resizeToContents(ref.current);
  }, []);
  hooks.useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-textarea",
    children: [jsxRuntime.jsx("label", {
      for: prefixId$1(id),
      class: "bio-properties-panel-label",
      children: jsxRuntime.jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    }), jsxRuntime.jsx("textarea", {
      ref: ref,
      id: prefixId$1(id),
      name: id,
      spellCheck: "false",
      class: classnames('bio-properties-panel-input', monospace ? 'bio-properties-panel-input-monospace' : '', autoResize ? 'auto-resize' : ''),
      onInput: handleInput,
      onFocus: onFocus,
      onBlur: onBlur,
      rows: rows,
      value: localValue,
      disabled: disabled,
      "data-gramm": "false"
    })]
  });
}

/**
 * @param {object} props
 * @param {object} props.element
 * @param {string} props.id
 * @param {string} props.description
 * @param {boolean} props.debounce
 * @param {string} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {number} props.rows
 * @param {boolean} props.monospace
 * @param {Function} [props.validate]
 * @param {boolean} [props.disabled]
 */
function TextAreaEntry(props) {
  const {
    element,
    id,
    description,
    debounce,
    label,
    getValue,
    setValue,
    rows,
    monospace,
    disabled,
    validate,
    onFocus,
    onBlur,
    autoResize,
    tooltip
  } = props;
  const globalError = useError(id);
  const [localError, setLocalError] = hooks.useState(null);
  let value = getValue(element);
  hooks.useEffect(() => {
    if (minDash.isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setLocalError(newValidationError);
    }
  }, [value, validate]);
  const onInput = newValue => {
    let newValidationError = null;
    if (minDash.isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }
    setValue(newValue, newValidationError);
    setLocalError(newValidationError);
  };
  const error = globalError || localError;
  return jsxRuntime.jsxs("div", {
    class: classnames('bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [jsxRuntime.jsx(TextArea, {
      id: id,
      label: label,
      value: value,
      onInput: onInput,
      onFocus: onFocus,
      onBlur: onBlur,
      rows: rows,
      debounce: debounce,
      monospace: monospace,
      disabled: disabled,
      autoResize: autoResize,
      tooltip: tooltip,
      element: element
    }, element), error && jsxRuntime.jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsxRuntime.jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited$1(node) {
  return node && !!node.value;
}

// helpers /////////////////

function prefixId$1(id) {
  return `bio-properties-panel-${id}`;
}
function Textfield(props) {
  const {
    debounce,
    disabled = false,
    id,
    label,
    onInput,
    onFocus,
    onBlur,
    value = '',
    tooltip
  } = props;
  const [localValue, setLocalValue] = hooks.useState(value || '');
  const ref = useShowEntryEvent(id);
  const handleInputCallback = hooks.useMemo(() => {
    return debounce(target => onInput(target.value.length ? target.value : undefined));
  }, [onInput, debounce]);
  const handleInput = e => {
    handleInputCallback(e.target);
    setLocalValue(e.target.value);
  };
  hooks.useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxRuntime.jsxs("div", {
    class: "bio-properties-panel-textfield",
    children: [jsxRuntime.jsx("label", {
      for: prefixId(id),
      class: "bio-properties-panel-label",
      children: jsxRuntime.jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    }), jsxRuntime.jsx("input", {
      ref: ref,
      id: prefixId(id),
      type: "text",
      name: id,
      spellCheck: "false",
      autoComplete: "off",
      disabled: disabled,
      class: "bio-properties-panel-input",
      onInput: handleInput,
      onFocus: onFocus,
      onBlur: onBlur,
      value: localValue
    })]
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {string|import('preact').Component} props.tooltip
 * @param {Function} props.validate
 */
function TextfieldEntry(props) {
  const {
    element,
    id,
    description,
    debounce,
    disabled,
    label,
    getValue,
    setValue,
    validate,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const globalError = useError(id);
  const [localError, setLocalError] = hooks.useState(null);
  let value = getValue(element);
  hooks.useEffect(() => {
    if (minDash.isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setLocalError(newValidationError);
    }
  }, [value, validate]);
  const onInput = newValue => {
    let newValidationError = null;
    if (minDash.isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }
    setValue(newValue, newValidationError);
    setLocalError(newValidationError);
  };
  const error = globalError || localError;
  return jsxRuntime.jsxs("div", {
    class: classnames('bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [jsxRuntime.jsx(Textfield, {
      debounce: debounce,
      disabled: disabled,
      id: id,
      label: label,
      onInput: onInput,
      onFocus: onFocus,
      onBlur: onBlur,
      value: value,
      tooltip: tooltip,
      element: element
    }, element), error && jsxRuntime.jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsxRuntime.jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited(node) {
  return node && !!node.value;
}

// helpers /////////////////

function prefixId(id) {
  return `bio-properties-panel-${id}`;
}
class FeelPopupModule {
  constructor(eventBus) {
    this._eventBus = eventBus;
  }

  /**
   * Check if the FEEL popup is open.
   * @return {Boolean}
   */
  isOpen() {
    return this._eventBus.fire('feelPopup._isOpen');
  }

  /**
   * Open the FEEL popup.
   *
   * @param {String} entryId
   * @param {Object} popupConfig
   * @param {HTMLElement} sourceElement
   */
  open(entryId, popupConfig, sourceElement) {
    return this._eventBus.fire('feelPopup._open', {
      entryId,
      popupConfig,
      sourceElement
    });
  }

  /**
   * Close the FEEL popup.
   */
  close() {
    return this._eventBus.fire('feelPopup._close');
  }
}
FeelPopupModule.$inject = ['eventBus'];
var index = {
  feelPopup: ['type', FeelPopupModule]
};

/**
 * @param {string} type
 * @param {boolean} [strict]
 *
 * @returns {any}
 */
function getService(type, strict) {}
const FormPropertiesPanelContext = preact.createContext({
  getService
});

function arrayAdd(array, index, item) {
  const copy = [...array];
  copy.splice(index, 0, item);
  return copy;
}
function countDecimals(number) {
  const num = Big(number);
  if (num.toString() === num.toFixed(0)) return 0;
  return num.toFixed().split('.')[1].length || 0;
}

/**
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidNumber(value) {
  return (typeof value === 'number' || typeof value === 'string') && value !== '' && !isNaN(Number(value));
}
function textToLabel(text) {
  if (typeof text != 'string') return null;
  for (const line of text.split('\n')) {
    const displayLine = line.trim();

    // we use the first non-whitespace line in the text as label
    if (displayLine !== '') {
      return displayLine;
    }
  }
  return null;
}

/**
  * @param {string} path
  */
function isValidDotPath(path) {
  return /^\w+(\.\w+)*$/.test(path);
}

/**
  * @param {string} path
  */
function isProhibitedPath(path) {
  const prohibitedSegments = ['__proto__', 'prototype', 'constructor'];
  return path.split('.').some(segment => prohibitedSegments.includes(segment));
}
const LABELED_NON_INPUTS = ['button', 'group', 'dynamiclist', 'iframe', 'table'];
const INPUTS = ['checkbox', 'checklist', 'datetime', 'number', 'radio', 'select', 'taglist', 'textfield', 'textarea'];
const OPTIONS_INPUTS = ['checklist', 'radio', 'select', 'taglist'];
function hasEntryConfigured(formFieldDefinition, entryId) {
  const {
    propertiesPanelEntries = []
  } = formFieldDefinition;
  if (!propertiesPanelEntries.length) {
    return false;
  }
  return propertiesPanelEntries.some(id => id === entryId);
}
function hasOptionsGroupsConfigured(formFieldDefinition) {
  const {
    propertiesPanelEntries = []
  } = formFieldDefinition;
  if (!propertiesPanelEntries.length) {
    return false;
  }
  return propertiesPanelEntries.some(id => id === 'values');
}

/**
  * @param {string} path
  */
function hasIntegerPathSegment(path) {
  return path.split('.').some(segment => /^\d+$/.test(segment));
}

function useService(type, strict) {
  const {
    getService
  } = hooks.useContext(FormPropertiesPanelContext);
  return getService(type, strict);
}

/**
 * Retrieve list of variables from the form schema.
 *
 * @returns { string[] } list of variables used in form schema
 */
function useVariables() {
  const form = useService('formEditor');
  const schema = form.getSchema();
  return formJsViewer.getSchemaVariables(schema);
}

const headerlessTypes = ['spacer', 'separator', 'expression', 'html'];
const PropertiesPanelHeaderProvider = {
  getElementLabel: field => {
    const {
      type
    } = field;
    if (headerlessTypes.includes(type)) {
      return '';
    }
    if (type === 'text') {
      return textToLabel(field.text);
    }
    if (type === 'image') {
      return field.alt;
    }
    if (type === 'default') {
      return field.id;
    }
    return field.label;
  },
  getElementIcon: field => {
    const {
      type
    } = field;

    // @Note: We know that we are inside the properties panel context,
    // so we can savely use the hook here.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const fieldDefinition = useService('formFields').get(type).config;
    const Icon = fieldDefinition.icon || formJsViewer.iconsByType(type);
    if (Icon) {
      return () => jsxRuntime.jsx(Icon, {
        width: "36",
        height: "36",
        viewBox: "0 0 54 54"
      });
    } else if (fieldDefinition.iconUrl) {
      return getPaletteIcon({
        iconUrl: fieldDefinition.iconUrl,
        label: fieldDefinition.label
      });
    }
  },
  getTypeLabel: field => {
    const {
      type
    } = field;
    if (type === 'default') {
      return 'Formulář';
    }

    // @Note: We know that we are inside the properties panel context,
    // so we can savely use the hook here.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const fieldDefinition = useService('formFields').get(type).config;
    return fieldDefinition.label || type;
  }
};

/**
 * Provide placeholders for empty and multiple state.
 */
const PropertiesPanelPlaceholderProvider = {
  getEmpty: () => {
    return {
      text: 'Select a form field to edit its properties.'
    };
  },
  getMultiple: () => {
    return {
      text: 'Multiple form fields are selected. Select a single form field to edit its properties.'
    };
  }
};

function PropertiesPanel(props) {
  const {
    eventBus,
    getProviders,
    injector
  } = props;
  const formEditor = injector.get('formEditor');
  const modeling = injector.get('modeling');
  const selectionModule = injector.get('selection');
  const propertiesPanelConfig = injector.get('config.propertiesPanel') || {};
  const {
    feelPopupContainer
  } = propertiesPanelConfig;
  const [state, setState] = hooks.useState({
    selectedFormField: selectionModule.get() || formEditor._getState().schema
  });
  const selectedFormField = state.selectedFormField;
  const refresh = hooks.useCallback(field => {
    // TODO(skaiir): rework state management, re-rendering the whole properties panel is not the way to go
    // https://github.com/bpmn-io/form-js/issues/686
    setState({
      selectedFormField: selectionModule.get() || formEditor._getState().schema
    });

    // notify interested parties on property panel updates
    eventBus.fire('propertiesPanel.updated', {
      formField: field
    });
  }, [eventBus, formEditor, selectionModule]);
  hooks.useLayoutEffect(() => {
    /**
     * TODO(pinussilvestrus): update with actual updated element,
     * once we have a proper updater/change support
     */
    eventBus.on('changed', refresh);
    eventBus.on('import.done', refresh);
    eventBus.on('selection.changed', refresh);
    return () => {
      eventBus.off('changed', refresh);
      eventBus.off('import.done', refresh);
      eventBus.off('selection.changed', refresh);
    };
  }, [eventBus, refresh]);
  const getService = (type, strict = true) => injector.get(type, strict);
  const propertiesPanelContext = {
    getService
  };
  const onFocus = () => eventBus.fire('propertiesPanel.focusin');
  const onBlur = () => eventBus.fire('propertiesPanel.focusout');
  const editField = hooks.useCallback((formField, key, value) => modeling.editFormField(formField, key, value), [modeling]);

  // retrieve groups for selected form field
  const providers = getProviders(selectedFormField);
  const groups = hooks.useMemo(() => {
    return minDash.reduce(providers, function (groups, provider) {
      // do not collect groups for multi element state
      if (minDash.isArray(selectedFormField)) {
        return [];
      }
      const updater = provider.getGroups(selectedFormField, editField);
      return updater(groups);
    }, []);
  }, [providers, selectedFormField, editField]);
  return jsxRuntime.jsx("div", {
    class: "fjs-properties-panel",
    "data-field": selectedFormField && selectedFormField.id,
    onFocusCapture: onFocus,
    onBlurCapture: onBlur,
    children: jsxRuntime.jsx(FormPropertiesPanelContext.Provider, {
      value: propertiesPanelContext,
      children: jsxRuntime.jsx(PropertiesPanel$1, {
        element: selectedFormField,
        eventBus: eventBus,
        groups: groups,
        headerProvider: PropertiesPanelHeaderProvider,
        placeholderProvider: PropertiesPanelPlaceholderProvider,
        feelPopupContainer: feelPopupContainer
      })
    })
  });
}

const DEFAULT_PRIORITY = 1000;

/**
 * @typedef { { parent: Element } } PropertiesPanelConfig
 * @typedef { import('../../core/EventBus').EventBus } EventBus
 * @typedef { import('../../types').Injector } Injector
 * @typedef { { getGroups: ({ formField, editFormField }) => ({ groups}) => Array } } PropertiesProvider
 */

/**
 * @param {PropertiesPanelConfig} propertiesPanelConfig
 * @param {Injector} injector
 * @param {EventBus} eventBus
 */
class PropertiesPanelRenderer {
  constructor(propertiesPanelConfig, injector, eventBus) {
    const {
      parent
    } = propertiesPanelConfig || {};
    this._eventBus = eventBus;
    this._injector = injector;
    this._container = minDom.domify('<div class="fjs-properties-container" input-handle-modified-keys="y,z"></div>');
    if (parent) {
      this.attachTo(parent);
    }
    this._eventBus.once('formEditor.rendered', 500, () => {
      this._render();
    });
  }

  /**
   * Attach the properties panel to a parent node.
   *
   * @param {HTMLElement} container
   */
  attachTo(container) {
    if (!container) {
      throw new Error('container required');
    }
    if (typeof container === 'string') {
      container = minDom.query(container);
    }

    // (1) detach from old parent
    this.detach();

    // (2) append to parent container
    container.appendChild(this._container);

    // (3) notify interested parties
    this._eventBus.fire('propertiesPanel.attach');
  }

  /**
   * Detach the properties panel from its parent node.
   */
  detach() {
    const parentNode = this._container.parentNode;
    if (parentNode) {
      parentNode.removeChild(this._container);
      this._eventBus.fire('propertiesPanel.detach');
    }
  }
  _render() {
    preact.render(jsxRuntime.jsx(PropertiesPanel, {
      getProviders: this._getProviders.bind(this),
      eventBus: this._eventBus,
      injector: this._injector
    }), this._container);
    this._eventBus.fire('propertiesPanel.rendered');
  }
  _destroy() {
    if (this._container) {
      preact.render(null, this._container);
      this._eventBus.fire('propertiesPanel.destroyed');
    }
  }

  /**
   * Register a new properties provider to the properties panel.
   *
   * @param {PropertiesProvider} provider
   * @param {Number} [priority]
   */
  registerProvider(provider, priority) {
    if (!priority) {
      priority = DEFAULT_PRIORITY;
    }
    if (typeof provider.getGroups !== 'function') {
      console.error('Properties provider does not implement #getGroups(element) API');
      return;
    }
    this._eventBus.on('propertiesPanel.getProviders', priority, function (event) {
      event.providers.push(provider);
    });
    this._eventBus.fire('propertiesPanel.providersChanged');
  }
  _getProviders() {
    const event = this._eventBus.createEvent({
      type: 'propertiesPanel.getProviders',
      providers: []
    });
    this._eventBus.fire(event);
    return event.providers;
  }
}
PropertiesPanelRenderer.$inject = ['config.propertiesPanel', 'injector', 'eventBus'];

function ActionEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'action',
    component: Action,
    editField: editField,
    field: field,
    isEdited: isEdited$3,
    isDefaultVisible: field => field.type === 'button'
  });
  return entries;
}
function Action(props) {
  const {
    editField,
    field,
    id
  } = props;
  const path = ['action'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  const getOptions = () => [{
    label: 'Odeslat',
    value: 'submit'
  }, {
    label: 'Resetovat',
    value: 'reset'
  }];
  return SelectEntry({
    element: field,
    getOptions,
    getValue,
    id,
    label: 'Akce',
    setValue
  });
}

function AltTextEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'alt',
    component: AltText,
    editField: editField,
    field: field,
    isEdited: isEdited$6,
    isDefaultVisible: field => ['image'].includes(field.type)
  });
  return entries;
}
function AltText(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['alt'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return FeelTemplatingEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'Zástupný text',
    tooltip: 'Popisný text pro přístupnost pomocí čtečky obrazovky.',
    setValue,
    singleLine: true,
    variables
  });
}

const AUTO_OPTION_VALUE = '';
function ColumnsEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [{
    id: 'columns',
    component: Columns,
    field,
    editField,
    isEdited: isEdited$3
  }];
  return entries;
}
function Columns(props) {
  const {
    field,
    editField,
    id
  } = props;
  const debounce = useService('debounce');
  const formLayoutValidator = useService('formLayoutValidator');
  const validate = hooks.useCallback(value => {
    return formLayoutValidator.validateField(field, value ? parseInt(value) : null);
  }, [field, formLayoutValidator]);
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const layout = minDash.get(field, ['layout'], {});
    const newValue = value ? parseInt(value) : null;
    editField(field, ['layout'], minDash.set(layout, ['columns'], newValue));
  };
  const getValue = () => {
    return minDash.get(field, ['layout', 'columns']);
  };
  const getOptions = () => {
    return [{
      label: 'Automaticky',
      value: AUTO_OPTION_VALUE
    },
    // todo(pinussilvestrus): make options dependant on field type
    // cf. https://github.com/bpmn-io/form-js/issues/575
    ...asArray(16).filter(i => i >= MIN_COLUMNS).map(asOption)];
  };
  return SelectEntry({
    debounce,
    element: field,
    id,
    label: 'Šířka sloupce',
    getOptions,
    getValue,
    setValue,
    validate
  });
}

// helper /////////

function asOption(number) {
  return {
    value: number,
    label: number.toString()
  };
}
function asArray(length) {
  return Array.from({
    length
  }).map((_, i) => i + 1);
}

function DescriptionEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'description',
    component: Description,
    editField: editField,
    field: field,
    isEdited: isEdited$6,
    isDefaultVisible: field => INPUTS.includes(field.type)
  });
  return entries;
}
function Description(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['description'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return FeelTemplatingEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Popisek',
    singleLine: true,
    setValue,
    variables
  });
}

const EMPTY_OPTION = null;
function DefaultValueEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  function isDefaultVisible(matchers) {
    return field => {
      // Only make default values available when they are statically defined
      if (!INPUTS.includes(type) || OPTIONS_INPUTS.includes(type) && !field.values) {
        return false;
      }
      return matchers(field);
    };
  }
  const defaulValueBase = {
    editField,
    field,
    id: 'defaultValue',
    label: 'Výchozí hodnota'
  };
  entries.push({
    ...defaulValueBase,
    component: DefaultValueCheckbox,
    isEdited: isEdited$3,
    isDefaultVisible: isDefaultVisible(field => field.type === 'checkbox')
  });
  entries.push({
    ...defaulValueBase,
    component: DefaultValueNumber,
    isEdited: isEdited,
    isDefaultVisible: isDefaultVisible(field => field.type === 'number')
  });
  entries.push({
    ...defaulValueBase,
    component: DefaultValueSingleSelect,
    isEdited: isEdited$3,
    isDefaultVisible: isDefaultVisible(field => field.type === 'radio' || field.type === 'select')
  });

  // todo(Skaiir): implement a multiselect equivalent (cf. https://github.com/bpmn-io/form-js/issues/265)

  entries.push({
    ...defaulValueBase,
    component: DefaultValueTextfield,
    isEdited: isEdited,
    isDefaultVisible: isDefaultVisible(field => field.type === 'textfield')
  });
  entries.push({
    ...defaulValueBase,
    component: DefaultValueTextarea,
    isEdited: isEdited$1,
    isDefaultVisible: isDefaultVisible(field => field.type === 'textarea')
  });
  return entries;
}
function DefaultValueCheckbox(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const {
    defaultValue
  } = field;
  const path = ['defaultValue'];
  const getOptions = () => {
    return [{
      label: 'Zaškrtnuto',
      value: 'true'
    }, {
      label: 'Nezaškrtnuto',
      value: 'false'
    }];
  };
  const setValue = value => {
    return editField(field, path, parseStringToBoolean(value));
  };
  const getValue = () => {
    return parseBooleanToString(defaultValue);
  };
  return SelectEntry({
    element: field,
    getOptions,
    getValue,
    id,
    label,
    setValue
  });
}
function DefaultValueNumber(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const {
    decimalDigits,
    serializeToString = false
  } = field;
  const debounce = useService('debounce');
  const path = ['defaultValue'];
  const getValue = e => {
    let value = minDash.get(field, path);
    if (!isValidNumber(value)) return;

    // Enforces decimal notation so that we do not submit defaults in exponent form
    return serializeToString ? Big(value).toFixed() : value;
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    let newValue;
    if (isValidNumber(value)) {
      newValue = serializeToString ? value : Number(value);
    }
    return editField(field, path, newValue);
  };
  const decimalDigitsSet = decimalDigits || decimalDigits === 0;
  const validate = hooks.useCallback(value => {
    if (value === undefined || value === null) {
      return;
    }
    if (!isValidNumber(value)) {
      return 'Hodnota musí být platné číslo';
    }
    if (decimalDigitsSet && countDecimals(value) > decimalDigits) {
      return `Hodnota nesmí obsahovat více než ${decimalDigits} desetinných míst`;
    }
  }, [decimalDigitsSet, decimalDigits]);
  return TextfieldEntry({
    debounce,
    label,
    element: field,
    getValue,
    id,
    setValue,
    validate
  });
}
function DefaultValueSingleSelect(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const {
    defaultValue = EMPTY_OPTION,
    values = []
  } = field;
  const path = ['defaultValue'];
  const getOptions = () => {
    return [{
      label: '<neurčeno>',
      value: EMPTY_OPTION
    }, ...values];
  };
  const setValue = value => {
    return editField(field, path, value.length ? value : undefined);
  };
  const getValue = () => {
    return defaultValue;
  };
  return SelectEntry({
    element: field,
    getOptions,
    getValue,
    id,
    label,
    setValue
  });
}
function DefaultValueTextfield(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const debounce = useService('debounce');
  const path = ['defaultValue'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label,
    setValue
  });
}
function DefaultValueTextarea(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const debounce = useService('debounce');
  const path = ['defaultValue'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return TextAreaEntry({
    debounce,
    element: field,
    getValue,
    id,
    label,
    setValue
  });
}

// helpers /////////////////

function parseStringToBoolean(value) {
  if (value === 'true') {
    return true;
  }
  return false;
}
function parseBooleanToString(value) {
  if (value === true) {
    return 'true';
  }
  return 'false';
}

function DisabledEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'disabled',
    component: Disabled,
    editField: editField,
    field: field,
    isEdited: isEdited$8,
    isDefaultVisible: field => INPUTS.includes(field.type)
  });
  return entries;
}
function Disabled(props) {
  const {
    editField,
    field,
    id
  } = props;
  const path = ['disabled'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return ToggleSwitchEntry({
    element: field,
    getValue,
    id,
    label: 'Deaktivováno',
    tooltip: 'Obsah pole nelze upravit a data se neodešlou. Má přednost před volbou "pouze pro čtení".',
    inline: true,
    setValue
  });
}

function IdEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'id',
    component: Id,
    editField: editField,
    field: field,
    isEdited: isEdited,
    isDefaultVisible: field => field.type === 'default'
  });
  return entries;
}
function Id(props) {
  const {
    editField,
    field,
    id
  } = props;
  const formFieldRegistry = useService('formFieldRegistry');
  const debounce = useService('debounce');
  const path = ['id'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    return editField(field, path, value);
  };
  const validate = hooks.useCallback(value => {
    if (typeof value !== 'string' || value.length === 0) {
      return 'Must not be empty.';
    }
    const assigned = formFieldRegistry._ids.assigned(value);
    if (assigned && assigned !== field) {
      return 'Must be unique.';
    }
    return validateId(value) || null;
  }, [formFieldRegistry, field]);
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'ID',
    setValue,
    validate
  });
}

// id structural validation /////////////

const SPACE_REGEX = /\s/;

// for QName validation as per http://www.w3.org/TR/REC-xml/#NT-NameChar
const QNAME_REGEX = /^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i;

// for ID validation as per BPMN Schema (QName - Namespace)
const ID_REGEX = /^[a-z_][\w-.]*$/i;
function validateId(idValue) {
  if (containsSpace(idValue)) {
    return 'Must not contain spaces.';
  }
  if (!ID_REGEX.test(idValue)) {
    if (QNAME_REGEX.test(idValue)) {
      return 'Must not contain prefix.';
    }
    return 'Must be a valid QName.';
  }
}
function containsSpace(value) {
  return SPACE_REGEX.test(value);
}

function KeyEntry(props) {
  const {
    editField,
    field,
    getService
  } = props;
  const entries = [];
  entries.push({
    id: 'key',
    component: Key$2,
    editField: editField,
    field: field,
    isEdited: isEdited,
    isDefaultVisible: field => {
      const formFields = getService('formFields');
      const {
        config
      } = formFields.get(field.type);
      return config.keyed;
    }
  });
  return entries;
}
function Key$2(props) {
  const {
    editField,
    field,
    id
  } = props;
  const pathRegistry = useService('pathRegistry');
  const debounce = useService('debounce');
  const path = ['key'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    return editField(field, path, value);
  };
  const validate = hooks.useCallback(value => {
    if (value === field.key) {
      return null;
    }
    if (!minDash.isString(value) || value.length === 0) {
      return 'Klíč nesmí být prázdný.';
    }
    if (!isValidDotPath(value)) {
      return 'Klíč musí být korektní proměnná nebo cesta oddělená tečkami.';
    }
    if (hasIntegerPathSegment(value)) {
      return 'Klíč nesmí obsahovat pouze čísla.';
    }
    if (isProhibitedPath(value)) {
      return 'Must not be a prohibited path.';
    }
    const replacements = {
      [field.id]: value.split('.')
    };
    const oldPath = pathRegistry.getValuePath(field);
    const newPath = pathRegistry.getValuePath(field, {
      replacements
    });

    // unclaim temporarily to avoid self-conflicts
    pathRegistry.unclaimPath(oldPath);
    const canClaim = pathRegistry.canClaimPath(newPath, {
      isClosed: true,
      claimerId: field.id
    });
    pathRegistry.claimPath(oldPath, {
      isClosed: true,
      claimerId: field.id
    });
    return canClaim ? null : 'Klíč se nesmí shodovat s již existujícím klíčem/cestou.';
  }, [field, pathRegistry]);
  return TextfieldEntry({
    debounce,
    description: 'Klíč, pod kterým je uložená hodnota pole.',
    element: field,
    getValue,
    id,
    label: 'Klíč',
    tooltip: 'Klíč slouží k identifikaci pole a jeho hodnoty v datovém schématu.',
    setValue,
    validate
  });
}

function PathEntry(props) {
  const {
    editField,
    field,
    getService
  } = props;
  const {
    type
  } = field;
  const entries = [];
  const formFieldDefinition = getService('formFields').get(type);
  if (formFieldDefinition && formFieldDefinition.config.pathed) {
    entries.push({
      id: 'path',
      component: Path,
      editField: editField,
      field: field,
      isEdited: isEdited
    });
  }
  return entries;
}
function Path(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const pathRegistry = useService('pathRegistry');
  const fieldConfig = useService('formFields').get(field.type).config;
  const isRepeating = fieldConfig.repeatable && field.isRepeating;
  const path = ['path'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    return editField(field, path, value);
  };
  const validate = hooks.useCallback(value => {
    if (!value && isRepeating) {
      return 'Must not be empty';
    }

    // Early return for empty value in non-repeating cases or if the field path hasn't changed
    if (!value && !isRepeating || value === field.path) {
      return null;
    }

    // Validate dot-separated path format
    if (!isValidDotPath(value)) {
      const msg = isRepeating ? 'Must be a variable or a dot-separated path' : 'Must be empty, a variable or a dot-separated path';
      return msg;
    }

    // Check for integer segments in the path
    if (hasIntegerPathSegment(value)) {
      return 'Must not contain numerical path segments.';
    }

    // Check for special prohibited paths
    if (isProhibitedPath(value)) {
      return 'Must not be a prohibited path.';
    }

    // Check for path collisions
    const options = {
      replacements: {
        [field.id]: value.split('.')
      }
    };
    const canClaim = pathRegistry.executeRecursivelyOnFields(field, ({
      field,
      isClosed,
      isRepeatable
    }) => {
      const path = pathRegistry.getValuePath(field, options);
      return pathRegistry.canClaimPath(path, {
        isClosed,
        isRepeatable,
        claimerId: field.id
      });
    });
    if (!canClaim) {
      return 'Must not cause two binding paths to collide';
    }

    // If all checks pass
    return null;
  }, [field, isRepeating, pathRegistry]);
  const tooltip = isRepeating ? 'Směruje podřízené proměnné komponentu do proměnné v datovém schématu. Lze ponachat prázdné pro uložení na kořenové úrovni.' : 'Směruje podřízené proměnné komponentu do proměnné v datovém schématu.';
  return TextfieldEntry({
    debounce,
    description: 'Cesta, kam se uloží podřízené proměnné komponentu.',
    element: field,
    getValue,
    id,
    label: 'Cesta',
    tooltip,
    setValue,
    validate
  });
}

function simpleBoolEntryFactory(options) {
  const {
    id,
    label,
    description,
    path,
    props,
    getValue,
    setValue,
    isDefaultVisible
  } = options;
  const {
    editField,
    field
  } = props;
  return {
    id,
    label,
    path,
    field,
    editField,
    description,
    component: SimpleBoolComponent,
    isEdited: isEdited$8,
    isDefaultVisible,
    getValue,
    setValue
  };
}
const SimpleBoolComponent = props => {
  const {
    id,
    label,
    path,
    field,
    editField,
    getValue = () => minDash.get(field, path, ''),
    setValue = value => editField(field, path, value || false),
    description
  } = props;
  return ToggleSwitchEntry({
    element: field,
    getValue,
    id,
    label,
    setValue,
    inline: true,
    description
  });
};

function simpleSelectEntryFactory(options) {
  const {
    id,
    label,
    path,
    props,
    optionsArray
  } = options;
  const {
    editField,
    field
  } = props;
  return {
    id,
    label,
    path,
    field,
    editField,
    optionsArray,
    component: SimpleSelectComponent,
    isEdited: isEdited$3
  };
}
const SimpleSelectComponent = props => {
  const {
    id,
    label,
    path,
    field,
    editField,
    optionsArray
  } = props;
  const getValue = () => minDash.get(field, path, '');
  const setValue = value => editField(field, path, value);
  const getOptions = () => optionsArray;
  return SelectEntry({
    label,
    element: field,
    getOptions,
    getValue,
    id,
    setValue
  });
};

function simpleRangeIntegerEntryFactory(options) {
  const {
    id,
    label,
    path,
    props,
    min,
    max
  } = options;
  const {
    editField,
    field
  } = props;
  return {
    id,
    label,
    path,
    field,
    editField,
    min,
    max,
    component: SimpleRangeIntegerEntry,
    isEdited: isEdited
  };
}
const SimpleRangeIntegerEntry = props => {
  const {
    id,
    label,
    path,
    field,
    editField,
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER
  } = props;
  const debounce = useService('debounce');
  const getValue = () => {
    const value = minDash.get(field, path);
    const isValid = isValidNumber(value) && Number.isInteger(value);
    return isValid ? value : null;
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, path, Number(value));
  };
  const validate = hooks.useCallback(value => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (!Number.isInteger(Number(value))) {
      return 'Hodnota musí být platné celé číslo.';
    }
    if (Big(value).cmp(min) < 0) {
      return `Hodnota musí být alespoň ${min}.`;
    }
    if (Big(value).cmp(max) > 0) {
      return `Hodnota nesmí být větší než ${max}.`;
    }
  }, [min, max]);
  return TextfieldEntry({
    debounce,
    label,
    element: field,
    getValue,
    id,
    setValue,
    validate
  });
};

function GroupAppearanceEntry(props) {
  const {
    field
  } = props;
  const {
    type
  } = field;
  if (!['group', 'dynamiclist'].includes(type)) {
    return [];
  }
  const entries = [simpleBoolEntryFactory({
    id: 'showOutline',
    path: ['showOutline'],
    label: 'Obrys sekce',
    props
  })];
  return entries;
}

function LabelEntry(props) {
  const {
    field,
    editField
  } = props;
  const entries = [];
  entries.push({
    id: 'date-label',
    component: DateLabel,
    editField,
    field,
    isEdited: isEdited$6,
    isDefaultVisible: function (field) {
      return field.type === 'datetime' && (field.subtype === formJsViewer.DATETIME_SUBTYPES.DATE || field.subtype === formJsViewer.DATETIME_SUBTYPES.DATETIME);
    }
  });
  entries.push({
    id: 'time-label',
    component: TimeLabel,
    editField,
    field,
    isEdited: isEdited$6,
    isDefaultVisible: function (field) {
      return field.type === 'datetime' && (field.subtype === formJsViewer.DATETIME_SUBTYPES.TIME || field.subtype === formJsViewer.DATETIME_SUBTYPES.DATETIME);
    }
  });
  const isSimplyLabled = field => {
    return [...INPUTS.filter(input => input !== 'datetime'), ...LABELED_NON_INPUTS].includes(field.type);
  };
  entries.push({
    id: 'label',
    component: Label$2,
    editField,
    field,
    isEdited: isEdited$6,
    isDefaultVisible: isSimplyLabled
  });
  return entries;
}
function Label$2(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['label'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || '');
  };
  const label = getLabelText(field.type);
  return FeelTemplatingEntry({
    debounce,
    element: field,
    getValue,
    id,
    label,
    singleLine: true,
    setValue,
    variables
  });
}
function DateLabel(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = formJsViewer.DATE_LABEL_PATH;
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || '');
  };
  return FeelTemplatingEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Nadpis datumu',
    singleLine: true,
    setValue,
    variables
  });
}
function TimeLabel(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = formJsViewer.TIME_LABEL_PATH;
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || '');
  };
  return FeelTemplatingEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Nadpis času',
    singleLine: true,
    setValue,
    variables
  });
}

// helpers //////////

/**
 * @param {string} type
 * @returns {string}
 */
function getLabelText(type) {
  switch (type) {
    case 'group':
    case 'dynamiclist':
      return 'Nadpis skupiny';
    case 'table':
      return 'Nadpis tabulky';
    case 'iframe':
      return 'Nadpis';
    default:
      return 'Nadpis pole';
  }
}

function HeightEntry(props) {
  const {
    editField,
    field,
    id,
    description,
    isDefaultVisible,
    defaultValue
  } = props;
  const entries = [];
  entries.push({
    id: id + '-height',
    component: Height,
    description,
    isEdited: isEdited$7,
    editField,
    field,
    defaultValue,
    isDefaultVisible: field => {
      if (minDash.isFunction(isDefaultVisible)) {
        return isDefaultVisible(field);
      }
      return field.type === 'spacer';
    }
  });
  return entries;
}
function Height(props) {
  const {
    description,
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const getValue = e => minDash.get(field, ['height'], null);
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, ['height'], value);
  };
  return NumberFieldEntry({
    debounce,
    description,
    label: 'Výška v pixelech',
    element: field,
    id,
    getValue,
    setValue,
    validate: validate$7
  });
}

// helpers //////////

/**
  * @param {number|void} value
  * @returns {string|null}
  */
const validate$7 = value => {
  if (typeof value !== 'number') {
    return 'Pole musí obsahovat číslo.';
  }
  if (!Number.isInteger(value)) {
    return 'Hodnota musí být platné celé číslo.';
  }
  if (value < 1) {
    return 'Hodnota musí být větší než 0.';
  }
};

function IFrameHeightEntry(props) {
  return [...HeightEntry({
    ...props,
    description: 'Výška okna v pixelech.',
    isDefaultVisible: field => field.type === 'iframe'
  })];
}

const HTTPS_PATTERN = /^(https):\/\/*/i; // eslint-disable-line no-useless-escape

function IFrameUrlEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'url',
    component: Url,
    editField: editField,
    field: field,
    isEdited: isEdited$6,
    isDefaultVisible: field => field.type === 'iframe'
  });
  return entries;
}
function Url(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['url'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return FeelTemplatingEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'URL',
    setValue,
    singleLine: true,
    tooltip: getTooltip$1(),
    validate: validate$6,
    variables
  });
}

// helper //////////////////////

function getTooltip$1() {
  return jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [jsxRuntime.jsx("p", {
      children: "Jako zdroj pou\u017Eijte HTTPS URL adresu, \u0161ablonu nebo v\xFDraz (pro p\u0159ed\xE1n\xED hodnoty skrz prom\u011Bnnou)."
    }), jsxRuntime.jsx("p", {
      children: "Ujist\u011Bte se, \u017Ee je URL adresa bezpe\u010Dn\xE1, proto\u017Ee m\u016F\u017Ee p\u0159edstavovat bezpe\u010Dnostn\xED riziko."
    }), jsxRuntime.jsxs("p", {
      children: ["Ne v\u0161echny extern\xED zdroje mohou b\xFDt zobrazeny skrz iFrame. V\xEDce informac\xED najdete v ", jsxRuntime.jsx("a", {
        target: "_blank",
        href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
        children: "dokumentaci X-FRAME-OPTIONS"
      }), "."]
    })]
  });
}

/**
  * @param {string|void} value
  * @returns {string|null}
  */
const validate$6 = value => {
  if (!value || value.startsWith('=')) {
    return;
  }
  if (!HTTPS_PATTERN.test(value)) {
    return 'Z bezpečnostních důvodů musí URL adresa začínat "https".';
  }
};

function ImageSourceEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'source',
    component: Source$1,
    editField: editField,
    field: field,
    isEdited: isEdited$6,
    isDefaultVisible: field => field.type === 'image'
  });
  return entries;
}
function Source$1(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['source'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return FeelTemplatingEntry({
    debounce,
    description: 'Výraz, URL odkaz, nebo datové URI',
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'Zdroj obrázku',
    tooltip: 'Jako zdroj lze použít URL odkaz nebo datové URI se zakódovaným obrázkem (např. ve formátu data:image/jpeg;base64,<zakódovaný obrázek>).',
    setValue,
    singleLine: true,
    variables
  });
}

function TextEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [{
    id: 'text',
    component: Text,
    editField: editField,
    field: field,
    isEdited: isEdited$6,
    isDefaultVisible: field => field.type === 'text'
  }];
  return entries;
}
function Text(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['text'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || '');
  };
  return FeelTemplatingEntry({
    debounce,
    description: description$1,
    element: field,
    getValue,
    id,
    label: 'Text',
    hostLanguage: 'markdown',
    setValue,
    variables
  });
}
const description$1 = jsxRuntime.jsxs(jsxRuntime.Fragment, {
  children: ["Podporuje form\xE1t markdown a \u0161ablonov\xE1n\xED. ", jsxRuntime.jsx("a", {
    href: "https://docs.camunda.io/docs/components/modeler/forms/form-element-library/forms-element-library-text/",
    target: "_blank",
    children: "Dokumentace"
  })]
});

function HtmlEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [{
    id: 'content',
    component: Content,
    editField: editField,
    field: field,
    isEdited: isEdited$6,
    isDefaultVisible: field => field.type === 'html'
  }];
  return entries;
}
function Content(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['content'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || '');
  };
  return FeelTemplatingEntry({
    debounce,
    description,
    element: field,
    getValue,
    id,
    label: 'Obsah',
    hostLanguage: 'html',
    validate: validate$5,
    setValue,
    variables
  });
}

// helpers //////////

const description = jsxRuntime.jsxs(jsxRuntime.Fragment, {
  children: ["Podporuje HTML, styly a \u0161ablonov\xE1n\xED. ", jsxRuntime.jsx("a", {
    href: "https://docs.camunda.io/docs/next/components/modeler/forms/form-element-library/forms-element-library-html/",
    target: "_blank",
    children: "Dokumentace"
  })]
});

/**
  * @param {string|void} value
  * @returns {string|null}
  */
const validate$5 = value => {
  // allow empty state
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  // allow expressions
  if (value.startsWith('=')) {
    return null;
  }
};

function NumberEntries(props) {
  const {
    editField,
    field,
    id
  } = props;
  const entries = [];
  entries.push({
    id: id + '-decimalDigits',
    component: NumberDecimalDigits,
    isEdited: isEdited$7,
    editField,
    field,
    isDefaultVisible: field => field.type === 'number'
  });
  entries.push({
    id: id + '-step',
    component: NumberArrowStep,
    isEdited: isEdited,
    editField,
    field,
    isDefaultVisible: field => field.type === 'number'
  });
  return entries;
}
function NumberDecimalDigits(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const getValue = e => minDash.get(field, ['decimalDigits']);
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, ['decimalDigits'], value);
  };
  return NumberFieldEntry({
    debounce,
    label: 'Desetinná místa',
    element: field,
    step: 'any',
    getValue,
    id,
    setValue,
    validate: validateNumberEntries
  });
}
function NumberArrowStep(props) {
  const {
    editField,
    field,
    id
  } = props;
  const {
    decimalDigits
  } = field;
  const debounce = useService('debounce');
  const getValue = e => {
    let value = minDash.get(field, ['increment']);
    if (!isValidNumber(value)) return null;
    return value;
  };
  const clearLeadingZeroes = value => {
    if (!value) return value;
    const trimmed = value.replace(/^0+/g, '');
    return (trimmed.startsWith('.') ? '0' : '') + trimmed;
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, ['increment'], clearLeadingZeroes(value));
  };
  const decimalDigitsSet = decimalDigits || decimalDigits === 0;
  const validate = hooks.useCallback(value => {
    if (value === undefined || value === null) {
      return;
    }
    if (!isValidNumber(value)) {
      return 'Hodnota musí být platné číslo.';
    }
    if (Big(value).cmp(0) <= 0) {
      return 'Hodnota musí být větší než 0.';
    }
    if (decimalDigitsSet) {
      const minimumValue = Big(`1e-${decimalDigits}`);
      if (Big(value).cmp(minimumValue) < 0) {
        return `Hodnota musí být alespoň ${minimumValue.toString()}.`;
      }
      if (countDecimals(value) > decimalDigits) {
        return `Hodnota nesmí obsahovat více než ${decimalDigits} desetinných míst.`;
      }
    }
  }, [decimalDigitsSet, decimalDigits]);
  return TextfieldEntry({
    debounce,
    label: 'Krok',
    element: field,
    getValue,
    id,
    setValue,
    validate
  });
}

// helpers //////////

/**
 * @param {number|void} value
 * @returns {string|void}
 */
const validateNumberEntries = value => {
  if (typeof value !== 'number') {
    return;
  }
  if (!Number.isInteger(value)) {
    return 'Hodnota musí být platné celé číslo.';
  }
  if (value < 0) {
    return 'Hodnota musí být větší nebo rovna 0.';
  }
};

function ExpressionFieldEntries(props) {
  const {
    editField,
    field,
    id
  } = props;
  const entries = [];
  entries.push({
    id: `${id}-expression`,
    component: ExpressionFieldExpression,
    isEdited: isEdited$6,
    editField,
    field,
    isDefaultVisible: field => field.type === 'expression'
  });
  entries.push({
    id: `${id}-computeOn`,
    component: ExpressionFieldComputeOn,
    isEdited: isEdited$3,
    editField,
    field,
    isDefaultVisible: field => field.type === 'expression'
  });
  return entries;
}
function ExpressionFieldExpression(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const getValue = () => field.expression || '';
  const setValue = value => {
    editField(field, ['expression'], value);
  };
  return FeelEntry({
    debounce,
    description: 'Výraz pro výpočet hodnoty pole',
    element: field,
    feel: 'required',
    getValue,
    id,
    label: 'Cílová hodnota',
    setValue,
    variables
  });
}
function ExpressionFieldComputeOn(props) {
  const {
    editField,
    field,
    id
  } = props;
  const getValue = () => field.computeOn || '';
  const setValue = value => {
    editField(field, ['computeOn'], value);
  };
  const getOptions = () => [{
    value: 'change',
    label: 'Změna hodnoty'
  }, {
    value: 'presubmit',
    label: 'Odeslání formuláře'
  }];
  return SelectEntry({
    id,
    label: 'Spouštěč výpočtu',
    getValue,
    setValue,
    getOptions
  });
}

function NumberSerializationEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'serialize-to-string',
    component: SerializeToString,
    isEdited: isEdited$5,
    editField,
    field,
    isDefaultVisible: field => field.type === 'number'
  });
  return entries;
}
function SerializeToString(props) {
  const {
    editField,
    field,
    id
  } = props;
  const {
    defaultValue
  } = field;
  const path = ['serializeToString'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    // Whenever changing the formatting, make sure to change the default value type along with it
    if (defaultValue || defaultValue === 0) {
      editField(field, ['defaultValue'], value ? Big(defaultValue).toFixed() : Number(defaultValue));
    }
    return editField(field, path, value);
  };
  return CheckboxEntry({
    element: field,
    getValue,
    id,
    label: 'Uložit jako řetězec',
    description: 'Umožňuje uložit číslo s libovolnou přesností',
    setValue
  });
}

function DateTimeEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [{
    id: 'subtype',
    component: DateTimeSubtypeSelect,
    isEdited: isEdited$3,
    editField,
    field,
    isDefaultVisible: field => field.type === 'datetime'
  }];
  entries.push({
    id: 'use24h',
    component: Use24h,
    isEdited: isEdited$5,
    editField,
    field,
    isDefaultVisible: field => field.type === 'datetime' && (field.subtype === formJsViewer.DATETIME_SUBTYPES.TIME || field.subtype === formJsViewer.DATETIME_SUBTYPES.DATETIME)
  });
  return entries;
}
function DateTimeSubtypeSelect(props) {
  const {
    editField,
    field,
    id
  } = props;
  const getValue = e => minDash.get(field, formJsViewer.DATETIME_SUBTYPE_PATH);
  const clearTimeConfig = () => {
    const timeConfigPaths = [formJsViewer.TIME_LABEL_PATH, formJsViewer.TIME_USE24H_PATH, formJsViewer.TIME_INTERVAL_PATH, formJsViewer.TIME_SERIALISING_FORMAT_PATH];
    for (const path of timeConfigPaths) {
      editField(field, path, undefined);
    }
  };
  const initTimeConfig = () => {
    editField(field, formJsViewer.TIME_LABEL_PATH, 'Čas');
    editField(field, formJsViewer.TIME_SERIALISING_FORMAT_PATH, formJsViewer.TIME_SERIALISING_FORMATS.UTC_OFFSET);
    editField(field, formJsViewer.TIME_INTERVAL_PATH, 15);
  };
  const clearDateConfig = () => {
    const dateConfigPaths = [formJsViewer.DATE_LABEL_PATH, formJsViewer.DATE_DISALLOW_PAST_PATH];
    for (const path of dateConfigPaths) {
      editField(field, path, undefined);
    }
  };
  const initDateConfig = () => {
    editField(field, formJsViewer.DATE_LABEL_PATH, 'Datum');
  };
  const setValue = value => {
    const oldValue = getValue();
    if (oldValue === value) return;
    if (value === formJsViewer.DATETIME_SUBTYPES.DATE) {
      clearTimeConfig();
      oldValue === formJsViewer.DATETIME_SUBTYPES.TIME && initDateConfig();
    } else if (value === formJsViewer.DATETIME_SUBTYPES.TIME) {
      clearDateConfig();
      oldValue === formJsViewer.DATETIME_SUBTYPES.DATE && initTimeConfig();
    } else if (value === formJsViewer.DATETIME_SUBTYPES.DATETIME) {
      oldValue === formJsViewer.DATETIME_SUBTYPES.DATE && initTimeConfig();
      oldValue === formJsViewer.DATETIME_SUBTYPES.TIME && initDateConfig();
    }
    return editField(field, formJsViewer.DATETIME_SUBTYPE_PATH, value);
  };
  const getDatetimeSubtypes = () => {
    return Object.values(formJsViewer.DATETIME_SUBTYPES).map(subtype => ({
      label: formJsViewer.DATETIME_SUBTYPES_LABELS[subtype],
      value: subtype
    }));
  };
  return SelectEntry({
    label: 'Typ',
    element: field,
    getOptions: getDatetimeSubtypes,
    getValue,
    id,
    setValue
  });
}
function Use24h(props) {
  const {
    editField,
    field,
    id
  } = props;
  const path = formJsViewer.TIME_USE24H_PATH;
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return CheckboxEntry({
    element: field,
    getValue,
    id,
    label: '24h formát',
    setValue
  });
}

function DateTimeConstraintsEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  function isDefaultVisible(subtypes) {
    return field => {
      if (field.type !== 'datetime') {
        return false;
      }
      return subtypes.includes(field.subtype);
    };
  }
  const entries = [];
  entries.push({
    id: id + '-timeInterval',
    component: TimeIntervalSelect,
    isEdited: isEdited$3,
    editField,
    field,
    isDefaultVisible: isDefaultVisible([formJsViewer.DATETIME_SUBTYPES.TIME, formJsViewer.DATETIME_SUBTYPES.DATETIME])
  });
  entries.push({
    id: id + '-disallowPassedDates',
    component: DisallowPassedDates,
    isEdited: isEdited$5,
    editField,
    field,
    isDefaultVisible: isDefaultVisible([formJsViewer.DATETIME_SUBTYPES.DATE, formJsViewer.DATETIME_SUBTYPES.DATETIME])
  });
  return entries;
}
function DisallowPassedDates(props) {
  const {
    editField,
    field,
    id
  } = props;
  const path = formJsViewer.DATE_DISALLOW_PAST_PATH;
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return CheckboxEntry({
    element: field,
    getValue,
    id,
    label: 'Zakázat data v minulosti',
    setValue
  });
}
function TimeIntervalSelect(props) {
  const {
    editField,
    field,
    id
  } = props;
  const timeIntervals = [1, 5, 10, 15, 30, 60];
  const getValue = e => minDash.get(field, formJsViewer.TIME_INTERVAL_PATH);
  const setValue = value => editField(field, formJsViewer.TIME_INTERVAL_PATH, parseInt(value));
  const getTimeIntervals = () => {
    return timeIntervals.map(timeInterval => ({
      label: timeInterval === 60 ? '1h' : timeInterval + 'm',
      value: timeInterval
    }));
  };
  return SelectEntry({
    label: 'Časový interval',
    element: field,
    getOptions: getTimeIntervals,
    getValue,
    id,
    setValue
  });
}

function DateTimeFormatEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'time-format',
    component: TimeFormatSelect,
    isEdited: isEdited$3,
    editField,
    field,
    isDefaultVisible: field => field.type === 'datetime' && (field.subtype === formJsViewer.DATETIME_SUBTYPES.TIME || field.subtype === formJsViewer.DATETIME_SUBTYPES.DATETIME)
  });
  return entries;
}
function TimeFormatSelect(props) {
  const {
    editField,
    field,
    id
  } = props;
  const getValue = e => minDash.get(field, formJsViewer.TIME_SERIALISING_FORMAT_PATH);
  const setValue = value => editField(field, formJsViewer.TIME_SERIALISING_FORMAT_PATH, value);
  const getTimeSerialisingFormats = () => {
    return Object.values(formJsViewer.TIME_SERIALISING_FORMATS).map(format => ({
      label: formJsViewer.TIME_SERIALISINGFORMAT_LABELS[format],
      value: format
    }));
  };
  return SelectEntry({
    label: 'Časový formát',
    element: field,
    getOptions: getTimeSerialisingFormats,
    getValue,
    id,
    setValue
  });
}

function SelectEntries(props) {
  const entries = [simpleBoolEntryFactory({
    id: 'searchable',
    path: ['searchable'],
    label: 'Povolit vyhledávání',
    props,
    isDefaultVisible: field => field.type === 'select'
  })];
  return entries;
}

function ValueEntry(props) {
  const {
    editField,
    field,
    idPrefix,
    index,
    validateFactory
  } = props;
  const entries = [{
    component: Label$1,
    editField,
    field,
    id: idPrefix + '-label',
    idPrefix,
    index,
    validateFactory
  }, {
    component: Value$1,
    editField,
    field,
    id: idPrefix + '-value',
    idPrefix,
    index,
    validateFactory
  }];
  return entries;
}
function Label$1(props) {
  const {
    editField,
    field,
    id,
    index,
    validateFactory
  } = props;
  const debounce = useService('debounce');
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const values = minDash.get(field, ['values']);
    return editField(field, 'values', minDash.set(values, [index, 'label'], value));
  };
  const getValue = () => {
    return minDash.get(field, ['values', index, 'label']);
  };
  const validate = hooks.useMemo(() => validateFactory(minDash.get(field, ['values', index, 'label']), entry => entry.label), [field, index, validateFactory]);
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Název',
    setValue,
    validate
  });
}
function Value$1(props) {
  const {
    editField,
    field,
    id,
    index,
    validateFactory
  } = props;
  const debounce = useService('debounce');
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const values = minDash.get(field, ['values']);
    return editField(field, 'values', minDash.set(values, [index, 'value'], value));
  };
  const getValue = () => {
    return minDash.get(field, ['values', index, 'value']);
  };
  const validate = hooks.useMemo(() => validateFactory(minDash.get(field, ['values', index, 'value']), entry => entry.value), [field, index, validateFactory]);
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Hodnota',
    setValue,
    validate
  });
}

function CustomValueEntry(props) {
  const {
    editField,
    field,
    idPrefix,
    index,
    validateFactory
  } = props;
  const entries = [{
    component: Key$1,
    editField,
    field,
    id: idPrefix + '-key',
    idPrefix,
    index,
    validateFactory
  }, {
    component: Value,
    editField,
    field,
    id: idPrefix + '-value',
    idPrefix,
    index,
    validateFactory
  }];
  return entries;
}
function Key$1(props) {
  const {
    editField,
    field,
    id,
    index,
    validateFactory
  } = props;
  const debounce = useService('debounce');
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const properties = minDash.get(field, ['properties']);
    const key = Object.keys(properties)[index];
    return editField(field, 'properties', updateKey(properties, key, value));
  };
  const getValue = () => {
    return Object.keys(minDash.get(field, ['properties']))[index];
  };
  const validate = hooks.useMemo(() => validateFactory(Object.keys(minDash.get(field, ['properties']))[index]), [validateFactory, field, index]);
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Klíč',
    setValue,
    validate
  });
}
function Value(props) {
  const {
    editField,
    field,
    id,
    index,
    validateFactory
  } = props;
  const debounce = useService('debounce');
  const setValue = value => {
    const properties = minDash.get(field, ['properties']);
    const key = Object.keys(properties)[index];
    editField(field, 'properties', updateValue(properties, key, value));
  };
  const getValue = () => {
    const properties = minDash.get(field, ['properties']);
    const key = Object.keys(properties)[index];
    return minDash.get(field, ['properties', key]);
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Hodnota',
    setValue,
    validate: validateFactory(getValue())
  });
}

// helpers //////////

/**
 * Returns copy of object with updated value.
 *
 * @param {Object} properties
 * @param {string} key
 * @param {string} value
 *
 * @returns {Object}
 */
function updateValue(properties, key, value) {
  return {
    ...properties,
    [key]: value
  };
}

/**
 * Returns copy of object with updated key.
 *
 * @param {Object} properties
 * @param {string} oldKey
 * @param {string} newKey
 *
 * @returns {Object}
 */
function updateKey(properties, oldKey, newKey) {
  return Object.entries(properties).reduce((newProperties, entry) => {
    const [key, value] = entry;
    return {
      ...newProperties,
      [key === oldKey ? newKey : key]: value
    };
  }, {});
}

function AutoFocusSelectEntry(props) {
  const {
    autoFocusEntry,
    element,
    getValue
  } = props;
  const value = getValue(element);
  const prevValue = usePrevious(value);
  const eventBus = useService('eventBus');

  // auto focus specifc other entry when selected value changed
  hooks.useEffect(() => {
    if (autoFocusEntry && prevValue && value !== prevValue) {
      // @Note(pinussilvestrus): There is an issue in the properties
      // panel so we have to wait a bit before showing the entry.
      // Cf. https://github.com/camunda/linting/blob/4f5328e2722f73ae60ae584c5f576eaec3999cb2/lib/modeler/Linting.js#L37
      setTimeout(() => {
        eventBus.fire('propertiesPanel.showEntry', {
          id: autoFocusEntry
        });
      });
    }
  }, [value, autoFocusEntry, prevValue, eventBus]);
  return jsxRuntime.jsx(SelectEntry, {
    ...props
  });
}

function OptionsSourceSelectEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  return [{
    id: id + '-select',
    component: ValuesSourceSelect,
    isEdited: isEdited$3,
    editField,
    field
  }];
}
function ValuesSourceSelect(props) {
  const {
    editField,
    field,
    id
  } = props;
  const getValue = formJsViewer.getOptionsSource;
  const setValue = value => {
    let newField = field;
    const newProperties = {};
    newProperties[formJsViewer.OPTIONS_SOURCES_PATHS[value]] = formJsViewer.OPTIONS_SOURCES_DEFAULTS[value];
    newField = editField(field, newProperties);
    return newField;
  };
  const getOptionsSourceOptions = () => {
    return Object.values(formJsViewer.OPTIONS_SOURCES).map(valueSource => ({
      label: formJsViewer.OPTIONS_SOURCES_LABELS[valueSource],
      value: valueSource
    }));
  };
  return AutoFocusSelectEntry({
    autoFocusEntry: getAutoFocusEntryId$1(field),
    label: 'Typ',
    element: field,
    getOptions: getOptionsSourceOptions,
    getValue,
    id,
    setValue
  });
}

// helpers //////////

function getAutoFocusEntryId$1(field) {
  const valuesSource = formJsViewer.getOptionsSource(field);
  if (valuesSource === formJsViewer.OPTIONS_SOURCES.EXPRESSION) {
    return 'optionsExpression-expression';
  } else if (valuesSource === formJsViewer.OPTIONS_SOURCES.INPUT) {
    return 'dynamicOptions-key';
  } else if (valuesSource === formJsViewer.OPTIONS_SOURCES.STATIC) {
    return 'staticOptions-0-label';
  }
  return null;
}

function InputKeyOptionsSourceEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  return [{
    id: id + '-key',
    component: InputValuesKey,
    isEdited: isEdited,
    editField,
    field
  }];
}
function InputValuesKey(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const path = formJsViewer.OPTIONS_SOURCES_PATHS[formJsViewer.OPTIONS_SOURCES.INPUT];
  const schema = '[\n  {\n    "label": "dollar",\n    "value": "$"\n  }\n]';
  const tooltip = jsxRuntime.jsxs("div", {
    children: ["Vstup m\u016F\u017Ee b\xFDt pole jednoduch\xFDch hodnot nebo mus\xED podl\xE9hat n\xE1sleduj\xEDc\xEDmu sch\xE9matu:", jsxRuntime.jsx("pre", {
      children: jsxRuntime.jsx("code", {
        children: schema
      })
    })]
  });
  const getValue = () => minDash.get(field, path, '');
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, path, value || '');
  };
  return TextfieldEntry({
    debounce,
    description: 'Klíč ze schématu formuláře obsahující možnosti.',
    tooltip,
    element: field,
    getValue,
    id,
    label: 'Klíč vstupních hodnot',
    setValue,
    validate: validate$4
  });
}

// helpers //////////

/**
  * @param {string|void} value
  * @returns {string|null}
  */
const validate$4 = value => {
  if (typeof value !== 'string' || value.length === 0) {
    return 'Hodnota nesmí být prázdná.';
  }
  if (/\s/.test(value)) {
    return 'Hodnota nesmí obsahovat mezery.';
  }
  return null;
};

function StaticOptionsSourceEntry(props) {
  const {
    editField,
    field,
    id: idPrefix
  } = props;
  const {
    values
  } = field;
  const addEntry = e => {
    e.stopPropagation();
    const index = values.length + 1;
    const entry = getIndexedEntry(index, values);
    editField(field, formJsViewer.OPTIONS_SOURCES_PATHS[formJsViewer.OPTIONS_SOURCES.STATIC], arrayAdd(values, values.length, entry));
  };
  const removeEntry = entry => {
    editField(field, formJsViewer.OPTIONS_SOURCES_PATHS[formJsViewer.OPTIONS_SOURCES.STATIC], minDash.without(values, entry));
  };
  const validateFactory = (key, getValue) => {
    return value => {
      if (value === key) {
        return;
      }
      if (typeof value !== 'string' || value.length === 0) {
        return 'Hodnota nesmí být prázdná.';
      }
      const isValueAssigned = values.find(entry => getValue(entry) === value);
      if (isValueAssigned) {
        return 'Hodnota musí být unikátní.';
      }
    };
  };
  const items = values.map((entry, index) => {
    const id = idPrefix + '-' + index;
    return {
      id,
      label: entry.label,
      entries: ValueEntry({
        editField,
        field,
        idPrefix: id,
        index,
        validateFactory
      }),
      autoFocusEntry: id + '-label',
      remove: () => removeEntry(entry)
    };
  });
  return {
    items,
    add: addEntry,
    shouldSort: false
  };
}

// helper

function getIndexedEntry(index, values) {
  const entry = {
    label: 'Možnost',
    value: 'moznost'
  };
  while (labelOrValueIsAlreadyAssignedForIndex(index, values)) {
    index++;
  }
  if (index > 1) {
    entry.label += ` ${index}`;
    entry.value += `${index}`;
  }
  return entry;
}
function labelOrValueIsAlreadyAssignedForIndex(index, values) {
  return values.some(existingEntry => existingEntry.label === `Možnost ${index}` || existingEntry.value === `moznost${index}`);
}

function AdornerEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  const onChange = key => {
    return value => {
      const appearance = minDash.get(field, ['appearance'], {});
      editField(field, ['appearance'], minDash.set(appearance, [key], value));
    };
  };
  const getValue = key => {
    return () => {
      return minDash.get(field, ['appearance', key]);
    };
  };
  entries.push({
    id: 'prefix-adorner',
    component: PrefixAdorner,
    isEdited: isEdited$6,
    editField,
    field,
    onChange,
    getValue,
    isDefaultVisible: field => ['number', 'textfield'].includes(field.type)
  });
  entries.push({
    id: 'suffix-adorner',
    component: SuffixAdorner,
    isEdited: isEdited$6,
    editField,
    field,
    onChange,
    getValue,
    isDefaultVisible: field => ['number', 'textfield'].includes(field.type)
  });
  return entries;
}
function PrefixAdorner(props) {
  const {
    field,
    id,
    onChange,
    getValue
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelTemplatingEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue: getValue('prefixAdorner'),
    id,
    label: 'Předpona',
    setValue: onChange('prefixAdorner'),
    singleLine: true,
    variables
  });
}
function SuffixAdorner(props) {
  const {
    field,
    id,
    onChange,
    getValue
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelTemplatingEntry({
    debounce,
    element: field,
    getValue: getValue('suffixAdorner'),
    id,
    label: 'Přípona',
    setValue: onChange('suffixAdorner'),
    singleLine: true,
    variables
  });
}

function ReadonlyEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    disabled
  } = field;
  const entries = [];
  if (!disabled) {
    entries.push({
      id: 'readonly',
      component: Readonly,
      editField: editField,
      field: field,
      isEdited: isEdited$6,
      isDefaultVisible: field => INPUTS.includes(field.type)
    });
  }
  return entries;
}
function Readonly(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['readonly'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || false);
  };
  return FeelToggleSwitchEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'Pouze pro čtení',
    tooltip: 'Obsah pole nelze upravit, ale data se odešlou.',
    setValue,
    variables
  });
}

function LayouterAppearanceEntry(props) {
  const {
    field
  } = props;
  if (!['group', 'dynamiclist'].includes(field.type)) {
    return [];
  }
  const entries = [simpleSelectEntryFactory({
    id: 'verticalAlignment',
    path: ['verticalAlignment'],
    label: 'Vertikální zarovnání',
    optionsArray: [{
      value: 'start',
      label: 'Horní okraj'
    }, {
      value: 'center',
      label: 'Střed'
    }, {
      value: 'end',
      label: 'Dolní okraj'
    }],
    props
  })];
  return entries;
}

function RepeatableEntry(props) {
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
  const entries = [simpleRangeIntegerEntryFactory({
    id: 'defaultRepetitions',
    path: ['defaultRepetitions'],
    label: 'Výchozí počet položek',
    min: 1,
    max: 20,
    props
  }), simpleBoolEntryFactory({
    id: 'allowAddRemove',
    path: ['allowAddRemove'],
    label: 'Povolit přidání/mazání',
    props
  }), simpleBoolEntryFactory({
    id: 'disableCollapse',
    path: ['disableCollapse'],
    label: 'Zakázat sbalení seznamu',
    props
  })];
  if (!field.disableCollapse) {
    const nonCollapseItemsEntry = simpleRangeIntegerEntryFactory({
      id: 'nonCollapsedItems',
      path: ['nonCollapsedItems'],
      label: 'Počet rozbalených položek',
      min: 1,
      defaultValue: 5,
      props
    });
    entries.push(nonCollapseItemsEntry);
  }
  return entries;
}

function ConditionEntry(props) {
  const {
    editField,
    field
  } = props;
  return [{
    id: 'conditional-hide',
    component: Condition,
    editField: editField,
    field: field,
    isEdited: isEdited$6
  }];
}
function Condition(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['conditional', 'hide'];
  const getValue = () => {
    return minDash.get(field, path, '');
  };
  const setValue = value => {
    if (!value) {
      return editField(field, 'conditional', undefined);
    }
    return editField(field, 'conditional', {
      hide: value
    });
  };
  let label = 'Skrýt pokud';
  let description = 'Podmínka, při které zůstane komponent skrytý.';

  // special case for expression fields which do not render
  if (field.type === 'expression') {
    label = 'Deaktivovat pokud';
    description = 'Podmínka, při které zůstane výraz deaktivovaný.';
  }
  return FeelEntry({
    debounce,
    description,
    element: field,
    feel: 'required',
    getValue,
    id,
    label,
    setValue,
    variables
  });
}

function OptionsExpressionEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  return [{
    id: id + '-expression',
    component: OptionsExpression,
    isEdited: isEdited$6,
    editField,
    field
  }];
}
function OptionsExpression(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = formJsViewer.OPTIONS_SOURCES_PATHS[formJsViewer.OPTIONS_SOURCES.EXPRESSION];
  const schema = '[\n  {\n    "label": "dollar",\n    "value": "$"\n  }\n]';
  const tooltip = jsxRuntime.jsxs("div", {
    children: ["V\xFDsledek v\xFDrazu m\u016F\u017Ee b\xFDt pole jednoduch\xFDch hodnot nebo mus\xED podl\xE9hat n\xE1sleduj\xEDc\xEDmu sch\xE9matu:", jsxRuntime.jsx("pre", {
      children: jsxRuntime.jsx("code", {
        children: schema
      })
    })]
  });
  const getValue = () => minDash.get(field, path, '');
  const setValue = value => editField(field, path, value || '');
  return FeelEntry({
    debounce,
    description: 'Výraz, který naplní seznam možností.',
    tooltip,
    element: field,
    feel: 'required',
    getValue,
    id,
    label: 'Výraz',
    setValue,
    variables
  });
}

function TableDataSourceEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'dataSource',
    component: Source,
    editField: editField,
    field: field,
    isEdited: isEdited$6,
    isDefaultVisible: field => field.type === 'table'
  });
  return entries;
}
function Source(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['dataSource'];
  const getValue = () => {
    return minDash.get(field, path, field.id);
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, path, value);
  };
  return FeelTemplatingEntry({
    debounce,
    description: 'Uveďte zdroj dat pro naplnění tabulky',
    element: field,
    feel: 'required',
    getValue,
    id,
    label: 'Zdroj dat',
    tooltip: 'Zadejte vstupní proměnnou formuláře, která obsahuje data pro tabulku, nebo definujte výraz pro dynamické naplnění.',
    setValue,
    singleLine: true,
    variables,
    validate: validate$3
  });
}

// helper ////////////////

/**
   * @param {string|void} value
   * @returns {string|null}
   */
const validate$3 = value => {
  if (!minDash.isString(value) || value.length === 0) {
    return 'Must not be empty.';
  }
  if (value.startsWith('=')) {
    return null;
  }
  if (!isValidDotPath(value)) {
    return 'Must be a variable or a dot separated path.';
  }
  if (hasIntegerPathSegment(value)) {
    return 'Must not contain numerical path segments.';
  }
  return null;
};

function PaginationEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'pagination',
    component: Pagination,
    editField: editField,
    field: field,
    isEdited: isEdited$8,
    isDefaultVisible: field => field.type === 'table'
  });
  return entries;
}
function Pagination(props) {
  const {
    editField,
    field,
    id
  } = props;
  const defaultRowCount = 10;
  const path = ['rowCount'];
  const getValue = () => {
    return minDash.isNumber(minDash.get(field, path));
  };

  /**
    * @param {boolean} value
    */
  const setValue = value => {
    value ? editField(field, path, defaultRowCount) : editField(field, path, undefined);
  };
  return ToggleSwitchEntry({
    element: field,
    getValue,
    id,
    label: 'Stránkování',
    inline: true,
    setValue
  });
}

const path$2 = ['rowCount'];
function RowCountEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: 'rowCount',
    component: RowCount,
    isEdited: isEdited$7,
    editField,
    field,
    isDefaultVisible: field => field.type === 'table' && minDash.isNumber(minDash.get(field, path$2))
  });
  return entries;
}
function RowCount(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const getValue = () => minDash.get(field, path$2);

  /**
   * @param {number|void} value
   * @param {string|null} error
   * @returns {void}
   */
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, path$2, value);
  };
  return NumberFieldEntry({
    debounce,
    label: 'Počet řádků na stránce',
    element: field,
    id,
    getValue,
    setValue,
    validate: validate$2
  });
}

// helpers //////////

/**
   * @param {string|void} value
   * @returns {string|null}
   */
const validate$2 = value => {
  if (minDash.isNil(value)) {
    return null;
  }
  if (!minDash.isNumber(value)) {
    return 'Hodnota musí být číslo.';
  }
  if (!Number.isInteger(value)) {
    return 'Hodnota musí být platné celé číslo.';
  }
  if (value < 1) {
    return 'Hodnota musí být větší než 0.';
  }
  return null;
};

const OPTIONS = {
  static: {
    label: 'Seznam položek',
    value: 'static'
  },
  expression: {
    label: 'Výraz',
    value: 'expression'
  }
};
const SELECT_OPTIONS = Object.values(OPTIONS);
const COLUMNS_PATH = ['columns'];
const COLUMNS_EXPRESSION_PATH = ['columnsExpression'];
function HeadersSourceSelectEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  return [{
    id: id + '-select',
    component: HeadersSourceSelect,
    isEdited: isEdited$3,
    editField,
    field
  }];
}
function HeadersSourceSelect(props) {
  const {
    editField,
    field,
    id
  } = props;

  /**
   * @returns {string|void}
   */
  const getValue = () => {
    const columns = minDash.get(field, COLUMNS_PATH);
    const columnsExpression = minDash.get(field, COLUMNS_EXPRESSION_PATH);
    if (minDash.isString(columnsExpression)) {
      return OPTIONS.expression.value;
    }
    if (minDash.isArray(columns)) {
      return OPTIONS.static.value;
    }
  };

  /**
   * @param {string|void} value
   */
  const setValue = value => {
    switch (value) {
      case OPTIONS.static.value:
        editField(field, {
          columns: [{
            label: 'Sloupec',
            key: 'inputVariable'
          }]
        });
        break;
      case OPTIONS.expression.value:
        editField(field, {
          columnsExpression: '='
        });
        break;
    }
  };
  const getValuesSourceOptions = () => {
    return SELECT_OPTIONS;
  };
  return AutoFocusSelectEntry({
    autoFocusEntry: getAutoFocusEntryId(field),
    label: 'Typ',
    element: field,
    getOptions: getValuesSourceOptions,
    getValue,
    id,
    setValue
  });
}

// helpers //////////

function getAutoFocusEntryId(field) {
  const columns = minDash.get(field, COLUMNS_PATH);
  const columnsExpression = minDash.get(field, COLUMNS_EXPRESSION_PATH);
  if (minDash.isString(columnsExpression)) {
    return `${field.id}-columnsExpression`;
  }
  if (minDash.isArray(columns)) {
    return `${field.id}-columns-0-label`;
  }
  return null;
}

const PATH = ['columnsExpression'];
function ColumnsExpressionEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  entries.push({
    id: `${field.id}-columnsExpression`,
    component: ColumnsExpression,
    editField: editField,
    field: field,
    isEdited: isEdited$6,
    isDefaultVisible: field => field.type === 'table' && minDash.isString(minDash.get(field, PATH))
  });
  return entries;
}
function ColumnsExpression(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const getValue = () => {
    return minDash.get(field, PATH);
  };

  /**
    * @param {string|void} value
    * @param {string|void} error
    * @returns {void}
    */
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, PATH, value);
  };
  const schema = '[\n  {\n    "key": "column_1",\n    "label": "Column 1"\n  }\n]';
  const tooltip = jsxRuntime.jsxs("div", {
    children: ["V\xFDsledek v\xFDrazu m\u016F\u017Ee b\xFDt pole jednoduch\xFDch hodnot nebo mus\xED podl\xE9hat n\xE1sleduj\xEDc\xEDmu sch\xE9matu:", jsxRuntime.jsx("pre", {
      children: jsxRuntime.jsx("code", {
        children: schema
      })
    })]
  });
  return FeelTemplatingEntry({
    debounce,
    description: 'Výraz pro naplnění záhlaví',
    element: field,
    feel: 'required',
    getValue,
    id,
    label: 'Výraz',
    tooltip,
    setValue,
    singleLine: true,
    variables,
    validate: validate$1
  });
}

// helpers //////////

/**
   * @param {string|void} value
   * @returns {string|null}
   */
const validate$1 = value => {
  if (!minDash.isString(value) || value.length === 0 || value === '=') {
    return 'Hodnota nesmí být prázdná.';
  }
  return null;
};

const path$1 = 'columns';
const labelPath = 'label';
const keyPath = 'key';
function ColumnEntry(props) {
  const {
    editField,
    field,
    idPrefix,
    index
  } = props;
  const entries = [{
    component: Label,
    editField,
    field,
    id: idPrefix + '-label',
    idPrefix,
    index
  }, {
    component: Key,
    editField,
    field,
    id: idPrefix + '-key',
    idPrefix,
    index
  }];
  return entries;
}
function Label(props) {
  const {
    editField,
    field,
    id,
    index
  } = props;
  const debounce = useService('debounce');

  /**
    * @param {string|void} value
    * @param {string|void} error
    * @returns {void}
    */
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const columns = minDash.get(field, [path$1]);
    editField(field, path$1, minDash.set(columns, [index, labelPath], value));
  };
  const getValue = () => {
    return minDash.get(field, [path$1, index, labelPath]);
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Název',
    setValue
  });
}
function Key(props) {
  const {
    editField,
    field,
    id,
    index
  } = props;
  const debounce = useService('debounce');

  /**
    * @param {string|void} value
    * @param {string|void} error
    * @returns {void}
    */
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const columns = minDash.get(field, [path$1]);
    editField(field, path$1, minDash.set(columns, [index, keyPath], value));
  };
  const getValue = () => {
    return minDash.get(field, [path$1, index, keyPath]);
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Klíč',
    setValue,
    validate
  });
}

// helpers //////////////////////

/**
  * @param {string|void} value
  * @returns {string|null}
  */
function validate(value) {
  if (!minDash.isString(value) || value.length === 0) {
    return 'Hodnota nesmí být prázdná.';
  }
  return null;
}

const path = ['columns'];
function StaticColumnsSourceEntry(props) {
  const {
    editField,
    field,
    id: idPrefix
  } = props;
  const {
    columns
  } = field;
  const addEntry = event => {
    event.stopPropagation();
    const entry = {
      label: 'Sloupec',
      key: 'inputVariable'
    };
    editField(field, path, arrayAdd(columns, columns.length, entry));
  };
  const removeEntry = entry => {
    editField(field, path, minDash.without(columns, entry));
  };
  const items = columns.map((entry, index) => {
    const id = `${idPrefix}-${index}`;
    return {
      id,
      label: entry.label || entry.key,
      entries: ColumnEntry({
        editField,
        field,
        idPrefix: id,
        index
      }),
      autoFocusEntry: `${id}-label`,
      remove: () => removeEntry(entry)
    };
  });
  return {
    items,
    add: addEntry,
    shouldSort: false
  };
}

function GeneralGroup(field, editField, getService) {
  const entries = [...IdEntry({
    field,
    editField
  }), ...LabelEntry({
    field,
    editField
  }), ...DescriptionEntry({
    field,
    editField
  }), ...KeyEntry({
    field,
    editField,
    getService
  }), ...PathEntry({
    field,
    editField,
    getService
  }), ...RepeatableEntry({
    field,
    editField,
    getService
  }), ...DefaultValueEntry({
    field,
    editField
  }), ...ActionEntry({
    field,
    editField
  }), ...DateTimeEntry({
    field,
    editField
  }), ...TextEntry({
    field,
    editField,
    getService
  }), ...HtmlEntry({
    field,
    editField,
    getService
  }), ...IFrameUrlEntry({
    field,
    editField
  }), ...IFrameHeightEntry({
    field,
    editField
  }), ...HeightEntry({
    field,
    editField
  }), ...NumberEntries({
    field,
    editField
  }), ...ExpressionFieldEntries({
    field,
    editField
  }), ...ImageSourceEntry({
    field,
    editField
  }), ...AltTextEntry({
    field,
    editField
  }), ...SelectEntries({
    field,
    editField
  }), ...DisabledEntry({
    field,
    editField
  }), ...ReadonlyEntry({
    field,
    editField
  }), ...TableDataSourceEntry({
    field,
    editField
  }), ...PaginationEntry({
    field,
    editField
  }), ...RowCountEntry({
    field,
    editField
  })];
  if (entries.length === 0) {
    return null;
  }
  return {
    id: 'general',
    label: 'Obecné',
    entries
  };
}

function SerializationGroup(field, editField) {
  const entries = [...NumberSerializationEntry({
    field,
    editField
  }), ...DateTimeFormatEntry({
    field,
    editField
  })];
  if (!entries.length) {
    return null;
  }
  return {
    id: 'serialization',
    label: 'Serializace',
    entries
  };
}

function ConstraintsGroup(field, editField) {
  const entries = [...DateTimeConstraintsEntry({
    field,
    editField
  })];
  if (!entries.length) {
    return null;
  }
  return {
    id: 'constraints',
    label: 'Omezení',
    entries
  };
}

const VALIDATION_TYPE_OPTIONS = {
  custom: {
    value: '',
    label: 'Vlastní'
  },
  email: {
    value: 'email',
    label: 'Email'
  },
  phone: {
    value: 'phone',
    label: 'Telefon'
  }
};
function ValidationGroup(field, editField) {
  const {
    type
  } = field;
  const validate = minDash.get(field, ['validate'], {});
  const isCustomValidation = [undefined, VALIDATION_TYPE_OPTIONS.custom.value].includes(validate.validationType);
  const onChange = key => {
    return value => {
      const validate = minDash.get(field, ['validate'], {});
      editField(field, ['validate'], minDash.set(validate, [key], value));
    };
  };
  const getValue = key => {
    return () => {
      return minDash.get(field, ['validate', key]);
    };
  };
  let entries = [{
    id: 'required',
    component: Required,
    getValue,
    field,
    isEdited: isEdited$5,
    onChange,
    isDefaultVisible: field => INPUTS.includes(field.type)
  }];
  entries.push({
    id: 'validationType',
    component: ValidationType,
    getValue,
    field,
    editField,
    isEdited: isEdited,
    onChange,
    isDefaultVisible: field => field.type === 'textfield'
  });
  entries.push({
    id: 'minLength',
    component: MinLength,
    getValue,
    field,
    isEdited: isEdited$6,
    onChange,
    isDefaultVisible: field => INPUTS.includes(field.type) && (type === 'textarea' || type === 'textfield' && isCustomValidation)
  }, {
    id: 'maxLength',
    component: MaxLength,
    getValue,
    field,
    isEdited: isEdited$6,
    onChange,
    isDefaultVisible: field => INPUTS.includes(field.type) && (type === 'textarea' || type === 'textfield' && isCustomValidation)
  });
  entries.push({
    id: 'pattern',
    component: Pattern,
    getValue,
    field,
    isEdited: isEdited,
    onChange,
    isDefaultVisible: field => INPUTS.includes(field.type) && type === 'textfield' && isCustomValidation
  });
  entries.push({
    id: 'min',
    component: Min,
    getValue,
    field,
    isEdited: isEdited$6,
    onChange,
    isDefaultVisible: field => field.type === 'number'
  }, {
    id: 'max',
    component: Max,
    getValue,
    field,
    isEdited: isEdited$6,
    onChange,
    isDefaultVisible: field => field.type === 'number'
  });
  return {
    id: 'validation',
    label: 'Validace',
    entries
  };
}
function Required(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  return CheckboxEntry({
    element: field,
    getValue: getValue('required'),
    id,
    label: 'Povinné',
    setValue: onChange('required')
  });
}
function MinLength(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelNumberEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue: getValue('minLength'),
    id,
    label: 'Minimální délka',
    min: 0,
    setValue: onChange('minLength'),
    variables
  });
}
function MaxLength(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelNumberEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue: getValue('maxLength'),
    id,
    label: 'Maximální délka',
    min: 0,
    setValue: onChange('maxLength'),
    variables
  });
}
function Pattern(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  return TextfieldEntry({
    debounce,
    element: field,
    getValue: getValue('pattern'),
    id,
    label: 'Regulární výraz',
    setValue: onChange('pattern')
  });
}
function Min(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelNumberEntry({
    debounce,
    element: field,
    feel: 'optional',
    id,
    label: 'Minimální hodnota',
    step: 'any',
    getValue: getValue('min'),
    setValue: onChange('min'),
    variables
  });
}
function Max(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelNumberEntry({
    debounce,
    element: field,
    feel: 'optional',
    id,
    label: 'Maximální hodnota',
    step: 'any',
    getValue: getValue('max'),
    setValue: onChange('max'),
    variables
  });
}
function ValidationType(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const setValue = validationType => {
    onChange('validationType')(validationType || undefined);
  };
  return SelectEntry({
    debounce,
    element: field,
    getValue: getValue('validationType'),
    id,
    label: 'Vzor validace',
    setValue,
    getOptions: () => Object.values(VALIDATION_TYPE_OPTIONS),
    tooltip: getValue('validationType')() === VALIDATION_TYPE_OPTIONS.phone.value ? 'Validace telefonního čísla je založena na standardu E.164 bez mezer. (např. +491234567890)' : undefined
  });
}

function OptionsGroups(field, editField, getService) {
  const {
    type
  } = field;
  const formFields = getService('formFields');
  const fieldDefinition = formFields.get(type).config;
  if (!OPTIONS_INPUTS.includes(type) && !hasOptionsGroupsConfigured(fieldDefinition)) {
    return [];
  }
  const context = {
    editField,
    field
  };
  const id = 'valuesSource';

  /**
   * @type {Array<Group|ListGroup>}
   */
  const groups = [{
    id,
    label: 'Zdroj možností',
    tooltip: getValuesTooltip(),
    component: Group,
    entries: OptionsSourceSelectEntry({
      ...context,
      id
    })
  }];
  const valuesSource = formJsViewer.getOptionsSource(field);
  if (valuesSource === formJsViewer.OPTIONS_SOURCES.INPUT) {
    const id = 'dynamicOptions';
    groups.push({
      id,
      label: 'Dynamické možnosti',
      component: Group,
      entries: InputKeyOptionsSourceEntry({
        ...context,
        id
      })
    });
  } else if (valuesSource === formJsViewer.OPTIONS_SOURCES.STATIC) {
    const id = 'staticOptions';
    groups.push({
      id,
      label: 'Statické možnosti',
      component: ListGroup,
      ...StaticOptionsSourceEntry({
        ...context,
        id
      })
    });
  } else if (valuesSource === formJsViewer.OPTIONS_SOURCES.EXPRESSION) {
    const id = 'optionsExpression';
    groups.push({
      id,
      label: 'Výraz s možnostmi',
      component: Group,
      entries: OptionsExpressionEntry({
        ...context,
        id
      })
    });
  }
  return groups;
}

// helpers //////////

function getValuesTooltip() {
  return '"Staticky" - Možnosti existují ve formě předem definovaných konstant.\n\n' + '"Dynamicky" - Možnosti jsou načítány z proměnné schématu, kterou lze plnit na základě podmínek.\n\n' + '"Výraz" - Možnosti jsou načteny pomocí FEEL výrazu.';
}

function CustomPropertiesGroup(field, editField) {
  const {
    properties = {},
    type
  } = field;
  if (type === 'default') {
    return null;
  }
  const addEntry = event => {
    event.stopPropagation();
    let index = Object.keys(properties).length + 1;
    while (`key${index}` in properties) {
      index++;
    }
    editField(field, ['properties'], {
      ...properties,
      [`key${index}`]: 'value'
    });
  };
  const validateFactory = key => {
    return value => {
      if (value === key) {
        return;
      }
      if (typeof value !== 'string' || value.length === 0) {
        return 'Hodnota nesmí být prázdná.';
      }
      if (minDash.has(properties, value)) {
        return 'Hodnota musí být unikátní.';
      }
    };
  };
  const items = Object.keys(properties).map((key, index) => {
    const removeEntry = event => {
      event.stopPropagation();
      return editField(field, ['properties'], removeKey(properties, key));
    };
    const id = `property-${index}`;
    return {
      autoFocusEntry: id + '-key',
      entries: CustomValueEntry({
        editField,
        field,
        idPrefix: id,
        index,
        validateFactory
      }),
      id,
      label: key || '',
      remove: removeEntry
    };
  });
  return {
    add: addEntry,
    component: ListGroup,
    id: 'custom-values',
    items,
    label: 'Další vlastnosti',
    tooltip: 'Přidejte další vlastnosti ve formátu klíč-hodnota přímo do schéma formuláře.',
    shouldSort: false
  };
}

// helpers //////////

/**
 * Returns copy of object without key.
 *
 * @param {Object} properties
 * @param {string} oldKey
 *
 * @returns {Object}
 */
function removeKey(properties, oldKey) {
  return Object.entries(properties).reduce((newProperties, entry) => {
    const [key, value] = entry;
    if (key === oldKey) {
      return newProperties;
    }
    return {
      ...newProperties,
      [key]: value
    };
  }, {});
}

function AppearanceGroup(field, editField, getService) {
  const entries = [...AdornerEntry({
    field,
    editField
  }), ...GroupAppearanceEntry({
    field,
    editField
  }), ...LayouterAppearanceEntry({
    field,
    editField
  })];
  if (!entries.length) {
    return null;
  }
  return {
    id: 'appearance',
    label: 'Vzhled',
    entries
  };
}

function LayoutGroup(field, editField) {
  const {
    type
  } = field;
  if (type === 'default') {
    return null;
  }
  const entries = [...ColumnsEntry({
    field,
    editField
  })];
  if (entries.length === 0) {
    return null;
  }
  return {
    id: 'layout',
    label: 'Rozložení',
    entries
  };
}

function SecurityAttributesGroup(field, editField) {
  const {
    type
  } = field;
  if (type !== 'iframe') {
    return null;
  }
  const entries = createEntries({
    field,
    editField
  });
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
  const securityEntries = formJsViewer.SECURITY_ATTRIBUTES_DEFINITIONS.map(definition => {
    const {
      label,
      property
    } = definition;
    return simpleBoolEntryFactory({
      id: property,
      label: label,
      isDefaultVisible: field => field.type === 'iframe',
      path: ['security', property],
      props,
      getValue: () => minDash.get(field, ['security', property]),
      setValue: value => {
        const security = minDash.get(field, ['security'], {});
        editField(field, ['security'], minDash.set(security, [property], value));
      }
    });
  });
  return [{
    component: Advisory
  }, ...securityEntries];
}
const Advisory = props => {
  return jsxRuntime.jsx("div", {
    class: "bio-properties-panel-description fjs-properties-panel-detached-description",
    children: "Tyto mo\u017Enosti mohou p\u0159edstavovat bezpe\u010Dnostn\xED rizika, zejm\xE9na pokud se pou\u017E\xEDvaj\xED v kombinaci s dynamick\xFDmi odkazy. Ujist\u011Bte se, \u017Ee o nich v\xEDte, \u017Ee d\u016Fv\u011B\u0159ujete zdrojov\xE9 adrese URL a povol\xEDte pouze to, co v\xE1\u0161 p\u0159\xEDpad pou\u017Eit\xED vy\u017Eaduje."
  });
};

// helpers //////////

function getTooltip() {
  return jsxRuntime.jsx(jsxRuntime.Fragment, {
    children: jsxRuntime.jsxs("p", {
      children: ["Povolte prvku iFrame p\u0159\xEDstup k dal\u0161\xEDm funkc\xEDm va\u0161eho prohl\xED\u017Ee\u010De. Podrobnosti t\xFDkaj\xEDc\xED se r\u016Fzn\xFDch mo\u017Enost\xED naleznete v ", jsxRuntime.jsx("a", {
        target: "_blank",
        href: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe",
        children: "MDN dokumentaci iFrame."
      })]
    })
  });
}

function ConditionGroup(field, editField) {
  const {
    type
  } = field;
  if (type === 'default') {
    return null;
  }
  const entries = [...ConditionEntry({
    field,
    editField
  })];
  return {
    id: 'condition',
    label: 'Podmínky',
    entries
  };
}

function TableHeaderGroups(field, editField) {
  const {
    type,
    id: fieldId
  } = field;
  if (type !== 'table') {
    return [];
  }
  const areStaticColumnsEnabled = minDash.isArray(minDash.get(field, ['columns']));

  /**
    * @type {Array<Group>}
    */
  const groups = [{
    id: `${fieldId}-columnsSource`,
    label: 'Zdroj záhlaví',
    tooltip: TOOLTIP_TEXT,
    component: Group,
    entries: [...HeadersSourceSelectEntry({
      field,
      editField
    }), ...ColumnsExpressionEntry({
      field,
      editField
    })]
  }];
  if (areStaticColumnsEnabled) {
    const id = `${fieldId}-columns`;
    groups.push({
      id,
      label: 'Položky záhlaví',
      component: ListGroup,
      ...StaticColumnsSourceEntry({
        field,
        editField,
        id
      })
    });
  }
  return groups;
}

// helpers //////////

const TOOLTIP_TEXT = `"Seznam položek" - Záhlaví je naplněno z předem definovaných statických položek.

"Výraz" - Záhlaví je naplněno pomocí výsledku FEEL výrazu.
`;

class PropertiesProvider {
  constructor(propertiesPanel, injector) {
    this._injector = injector;
    propertiesPanel.registerProvider(this);
  }
  _filterVisibleEntries(groups, field, getService) {
    return groups.forEach(group => {
      const {
        entries
      } = group;
      const {
        type
      } = field;
      const formFields = getService('formFields');
      const fieldDefinition = formFields.get(type).config;
      if (!entries) {
        return;
      }
      group.entries = entries.filter(entry => {
        const {
          isDefaultVisible
        } = entry;
        if (!isDefaultVisible) {
          return true;
        }
        return isDefaultVisible(field) || hasEntryConfigured(fieldDefinition, entry.id);
      });
    });
  }
  getGroups(field, editField) {
    return groups => {
      if (!field) {
        return groups;
      }
      const getService = (type, strict = true) => this._injector.get(type, strict);
      groups = [...groups, GeneralGroup(field, editField, getService), ...TableHeaderGroups(field, editField), SecurityAttributesGroup(field, editField), ConditionGroup(field, editField), LayoutGroup(field, editField), AppearanceGroup(field, editField), SerializationGroup(field, editField), ...OptionsGroups(field, editField, getService), ConstraintsGroup(field, editField), ValidationGroup(field, editField), CustomPropertiesGroup(field, editField)].filter(group => group != null);
      this._filterVisibleEntries(groups, field, getService);

      // contract: if a group has no entries or items, it should not be displayed at all
      return groups.filter(group => {
        return group.items || group.entries && group.entries.length;
      });
    };
  }
}
PropertiesProvider.$inject = ['propertiesPanel', 'injector'];

const PropertiesPanelModule = {
  __depends__: [index],
  __init__: ['propertiesPanel', 'propertiesProvider'],
  propertiesPanel: ['type', PropertiesPanelRenderer],
  propertiesProvider: ['type', PropertiesProvider]
};

/**
 * Manages the rendering of visual plugins.
 * @constructor
 * @param {Object} eventBus - Event bus for the application.
 */
class RenderInjector extends SectionModuleBase {
  constructor(eventBus) {
    super(eventBus, 'renderInjector');
    this._eventBus = eventBus;
    this.registeredRenderers = [];
  }

  /**
   * Inject a new renderer into the injector.
   * @param {string} identifier - Identifier for the renderer.
   * @param {Function} Renderer - The renderer function.
   */
  attachRenderer(identifier, Renderer) {
    this.registeredRenderers = [...this.registeredRenderers, {
      identifier,
      Renderer
    }];
  }

  /**
   * Detach a renderer from the by key injector.
   * @param {string} identifier - Identifier for the renderer.
   */
  detachRenderer(identifier) {
    this.registeredRenderers = this.registeredRenderers.filter(r => r.identifier !== identifier);
  }

  /**
   * Returns the registered renderers.
   * @returns {Array} Array of registered renderers.
   */
  fetchRenderers() {
    return this.registeredRenderers;
  }
}
RenderInjector.$inject = ['eventBus'];

const RenderInjectionModule = {
  __init__: ['renderInjector'],
  renderInjector: ['type', RenderInjector]
};

var _path;
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
var SvgRepeat = function SvgRepeat(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none"
  }, props), _path || (_path = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "currentColor",
    d: "M3 3h10.086l-1.793-1.793L12 .5l3 3-3 3-.707-.707L13.086 4H3v3.5H2V4a1.001 1.001 0 0 1 1-1ZM4.707 10.207 2.914 12H13V8.5h1V12a1.002 1.002 0 0 1-1 1H2.914l1.793 1.793L4 15.5l-3-3 3-3 .707.707Z"
  })));
};
var RepeatSvg = SvgRepeat;

class EditorRepeatRenderManager {
  constructor(formFields, formFieldRegistry) {
    this._formFields = formFields;
    this._formFieldRegistry = formFieldRegistry;
    this.RepeatFooter = this.RepeatFooter.bind(this);
  }

  /**
   * Checks whether a field should be repeatable.
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
  RepeatFooter() {
    return jsxRuntime.jsxs("div", {
      className: "fjs-repeat-render-footer",
      children: [jsxRuntime.jsx(RepeatSvg, {}), jsxRuntime.jsx("span", {
        children: "Opakuj\xEDc\xED"
      })]
    });
  }
}
EditorRepeatRenderManager.$inject = ['formFields', 'formFieldRegistry'];

const RepeatRenderModule = {
  __init__: ['repeatRenderManager'],
  repeatRenderManager: ['type', EditorRepeatRenderManager]
};

const ids = new Ids([32, 36, 1]);

/**
 * @typedef { import('./types').Injector } Injector
 * @typedef { import('./types').Module } Module
 * @typedef { import('./types').Schema } Schema
 *
 * @typedef { import('./types').FormEditorOptions } FormEditorOptions
 * @typedef { import('./types').FormEditorProperties } FormEditorProperties
 *
 * @typedef { {
 *   properties: FormEditorProperties,
 *   schema: Schema
 * } } State
 *
 * @typedef { (type:string, priority:number, handler:Function) => void } OnEventWithPriority
 * @typedef { (type:string, handler:Function) => void } OnEventWithOutPriority
 * @typedef { OnEventWithPriority & OnEventWithOutPriority } OnEventType
 */

/**
 * The form editor.
 */
class FormEditor {
  /**
   * @constructor
   * @param {FormEditorOptions} options
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
    this._container = formJsViewer.createFormContainer();
    this._container.setAttribute('input-handle-modified-keys', 'z,y');
    const {
      container,
      exporter,
      injector = this._createInjector(options, this._container),
      properties = {}
    } = options;

    /**
     * @private
     * @type {any}
     */
    this.exporter = exporter;

    /**
     * @private
     * @type {State}
     */
    this._state = {
      properties,
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
    // clear form services
    this._emit('diagram.clear');

    // clear diagram services (e.g. EventBus)
    this._emit('form.clear');
  }
  destroy() {
    // destroy form services
    this.get('eventBus').fire('form.destroy');

    // destroy diagram services (e.g. EventBus)
    this.get('eventBus').fire('diagram.destroy');
    this._detach(false);
  }

  /**
   * @param {Schema} schema
   *
   * @return {Promise<{ warnings: Array<any> }>}
   */
  importSchema(schema) {
    return new Promise((resolve, reject) => {
      try {
        this.clear();
        const {
          schema: importedSchema,
          warnings
        } = this.get('importer').importSchema(schema);
        this._setState({
          schema: importedSchema
        });
        this._emit('import.done', {
          warnings
        });
        return resolve({
          warnings
        });
      } catch (error) {
        this._emit('import.done', {
          error: error,
          warnings: error.warnings || []
        });
        return reject(error);
      }
    });
  }

  /**
   * @returns {Schema}
   */
  saveSchema() {
    return this.getSchema();
  }

  /**
   * @returns {Schema}
   */
  getSchema() {
    const {
      schema
    } = this._getState();
    return exportSchema(schema, this.exporter, formJsViewer.schemaVersion);
  }

  /**
   * @param {Element|string} parentNode
   */
  attachTo(parentNode) {
    if (!parentNode) {
      throw new Error('parentNode required');
    }
    this.detach();
    if (minDash.isString(parentNode)) {
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
   * @internal
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
   * @param {any} property
   * @param {any} value
   */
  setProperty(property, value) {
    const properties = minDash.set(this._getState().properties, [property], value);
    this._setState({
      properties
    });
  }

  /**
   * @param {string} type
   * @param {Function} handler
   */
  off(type, handler) {
    this.get('eventBus').off(type, handler);
  }

  /**
   * @internal
   *
   * @param {FormEditorOptions} options
   * @param {Element} container
   *
   * @returns {Injector}
   */
  _createInjector(options, container) {
    const {
      modules = this._getModules(),
      additionalModules = [],
      renderer = {},
      ...config
    } = options;
    const enrichedConfig = {
      ...config,
      renderer: {
        ...renderer,
        container
      }
    };
    return formJsViewer.createInjector([{
      config: ['value', enrichedConfig]
    }, {
      formEditor: ['value', this]
    }, CoreModule, ...modules, ...additionalModules]);
  }

  /**
   * @internal
   */
  _emit(type, data) {
    this.get('eventBus').fire(type, data);
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
    return [ModelingModule, EditorActionsModule, FormEditorKeyboardModule, DraggingModule, SelectionModule, PaletteModule, EditorExpressionLanguageModule, formJsViewer.MarkdownRendererModule, PropertiesPanelModule, RenderInjectionModule, RepeatRenderModule];
  }

  /**
   * @internal
   */
  _onEvent(type, priority, handler) {
    this.get('eventBus').on(type, priority, handler);
  }
}

// helpers //////////

function exportSchema(schema, exporter, schemaVersion) {
  const exportDetails = exporter ? {
    exporter
  } : {};
  const cleanedSchema = formJsViewer.clone(schema, (name, value) => {
    if (['_parent', '_path'].includes(name)) {
      return undefined;
    }
    return value;
  });
  return {
    ...cleanedSchema,
    ...exportDetails,
    schemaVersion
  };
}

/**
 * @typedef { import('./types').CreateFormEditorOptions } CreateFormEditorOptions
 */

/**
 * Create a form editor.
 *
 * @param {CreateFormEditorOptions} options
 *
 * @return {Promise<FormEditor>}
 */
function createFormEditor(options) {
  const {
    schema,
    ...rest
  } = options;
  const formEditor = new FormEditor(rest);
  return formEditor.importSchema(schema).then(() => {
    return formEditor;
  });
}

Object.defineProperty(exports, 'schemaVersion', {
  enumerable: true,
  get: function () { return formJsViewer.schemaVersion; }
});
exports.FormEditor = FormEditor;
exports.createFormEditor = createFormEditor;
exports.useDebounce = useDebounce;
exports.usePrevious = usePrevious$1;
exports.usePropertiesPanelService = useService;
exports.useService = useService$1;
exports.useVariables = useVariables;
//# sourceMappingURL=index.cjs.map
