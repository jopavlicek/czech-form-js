import { render } from 'preact';
import fileDrop from 'file-drops';
import mitt from 'mitt';
import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { isFunction } from 'min-dash';
import download from 'downloadjs';
import classNames from 'classnames';
import { Form, getSchemaVariables } from '@bpmn-io/form-js-viewer';
import { FormEditor } from '@bpmn-io/form-js-editor';
import { jsxs, jsx } from 'preact/jsx-runtime';
import { basicSetup } from 'codemirror';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { Facet, Compartment, EditorState } from '@codemirror/state';
import { linter, lintGutter } from '@codemirror/lint';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { indentWithTab } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import { classes } from 'min-dom';

function Modal(props) {
  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        props.onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  });
  return jsxs("div", {
    class: "fjs-pgl-modal",
    children: [jsx("div", {
      class: "fjs-pgl-modal-backdrop",
      onClick: props.onClose
    }), jsxs("div", {
      class: "fjs-pgl-modal-content",
      children: [jsx("h1", {
        class: "fjs-pgl-modal-header",
        children: props.name
      }), jsx("div", {
        class: "fjs-pgl-modal-body",
        children: props.children
      }), jsx("div", {
        class: "fjs-pgl-modal-footer",
        children: jsx("button", {
          type: "button",
          class: "fjs-pgl-button fjs-pgl-button-default",
          onClick: props.onClose,
          children: "Close"
        })
      })]
    })]
  });
}

function EmbedModal(props) {
  const schema = serializeValue(props.schema);
  const data = serializeValue(props.data || {});
  const fieldRef = useRef();
  const snippet = `<!-- styles needed for rendering -->
<link rel="stylesheet" href="https://unpkg.com/@bpmn-io/form-js@0.2.4/dist/assets/form-js.css">

<!-- container to render the form into -->
<div class="fjs-pgl-form-container"></div>

<!-- scripts needed for embedding -->
<script src="https://unpkg.com/@bpmn-io/form-js@0.2.4/dist/form-viewer.umd.js"></script>

<!-- actual script to instantiate the form and load form schema + data -->
<script>
  const data = JSON.parse(${data});
  const schema = JSON.parse(${schema});

  const form = new FormViewer.Form({
    container: document.querySelector(".fjs-pgl-form-container")
  });

  form.on("submit", (event) => {
    console.log(event.data, event.errors);
  });

  form.importSchema(schema, data).catch(err => {
    console.error("Failed to render form", err);
  });
</script>
  `.trim();
  useEffect(() => {
    fieldRef.current.select();
  });
  return jsxs(Modal, {
    name: "Embed form",
    onClose: props.onClose,
    children: [jsxs("p", {
      children: ["Use the following HTML snippet to embed your form with ", jsx("a", {
        href: "https://github.com/bpmn-io/form-js",
        children: "form-js"
      }), ":"]
    }), jsx("textarea", {
      spellCheck: "false",
      ref: fieldRef,
      children: snippet
    })]
  });
}

// helpers ///////////

function serializeValue(obj) {
  return JSON.stringify(JSON.stringify(obj)).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * @type {Facet<import('..').Variables>} Variables
 */
const variablesFacet = Facet.define();

function autocompletionExtension() {
  return [autocompletion({
    override: [completions]
  })];
}
function completions(context) {
  const variables = context.state.facet(variablesFacet)[0];
  const options = variables.map(v => ({
    label: v,
    type: 'variable'
  }));
  let nodeBefore = syntaxTree(context.state).resolve(context.pos, -1);

  // handle inside property name as explicit call
  if (nodeBefore.type.name === 'PropertyName') {
    context.explicit = true;
  }
  let word = context.matchBefore(/\w*/);
  if (word.from == word.to && !context.explicit) {
    return null;
  }
  return {
    from: word.from,
    options
  };
}

const NO_LINT_CLS = 'fjs-cm-no-lint';

/**
 * @param {object} options
 * @param {boolean} [options.readonly]
 * @param {object} [options.contentAttributes]
 * @param {string | HTMLElement} [options.placeholder]
 */
function JSONEditor(options = {}) {
  const {
    contentAttributes = {},
    placeholder: editorPlaceholder,
    readonly = false
  } = options;
  const emitter = mitt();
  const languageCompartment = new Compartment().of(json());
  const tabSizeCompartment = new Compartment().of(EditorState.tabSize.of(2));
  const autocompletionConfCompartment = new Compartment();
  const placeholderLinterExtension = createPlaceholderLinterExtension();
  let container = null;
  function createState(doc, variables = []) {
    const extensions = [basicSetup, languageCompartment, tabSizeCompartment, lintGutter(), linter(jsonParseLinter()), placeholderLinterExtension, autocompletionConfCompartment.of(variablesFacet.of(variables)), autocompletionExtension(), keymap.of([indentWithTab]), editorPlaceholder ? placeholder(editorPlaceholder) : [], EditorState.readOnly.of(readonly), EditorView.updateListener.of(update => {
      if (update.docChanged) {
        emitter.emit('changed', {
          value: update.state.doc.toString()
        });
      }
    }), EditorView.contentAttributes.of(contentAttributes)];
    return EditorState.create({
      doc,
      extensions
    });
  }
  const view = new EditorView({
    state: createState('')
  });
  this.setValue = function (newValue) {
    const oldValue = view.state.doc.toString();
    const diff = findDiff(oldValue, newValue);
    if (diff) {
      view.dispatch({
        changes: {
          from: diff.start,
          to: diff.end,
          insert: diff.text
        },
        selection: {
          anchor: diff.start + diff.text.length
        }
      });
    }
  };
  this.getValue = function () {
    return view.state.doc.toString();
  };
  this.setVariables = function (variables) {
    view.dispatch({
      effects: autocompletionConfCompartment.reconfigure(variablesFacet.of(variables))
    });
  };
  this.getView = function () {
    return view;
  };
  this.on = emitter.on;
  this.off = emitter.off;
  this.emit = emitter.emit;
  this.attachTo = function (_container) {
    container = _container;
    container.appendChild(view.dom);
    classes(container, document.body).add('fjs-json-editor');
  };
  this.destroy = function () {
    if (container && view.dom) {
      container.removeChild(view.dom);
      classes(container, document.body).remove('fjs-json-editor');
    }
    view.destroy();
  };
  function createPlaceholderLinterExtension() {
    return linter(view => {
      const placeholders = view.dom.querySelectorAll('.cm-placeholder');
      if (placeholders.length > 0) {
        classes(container, document.body).add(NO_LINT_CLS);
      } else {
        classes(container, document.body).remove(NO_LINT_CLS);
      }
      return [];
    });
  }
}
function findDiff(oldStr, newStr) {
  if (oldStr === newStr) {
    return null;
  }
  oldStr = oldStr || '';
  newStr = newStr || '';
  let minLength = Math.min(oldStr.length, newStr.length);
  let start = 0;
  while (start < minLength && oldStr[start] === newStr[start]) {
    start++;
  }
  if (start === minLength) {
    return {
      start: start,
      text: newStr.slice(start),
      end: oldStr.length
    };
  }
  let endOld = oldStr.length;
  let endNew = newStr.length;
  while (endOld > start && endNew > start && oldStr[endOld - 1] === newStr[endNew - 1]) {
    endOld--;
    endNew--;
  }
  return {
    start: start,
    text: newStr.slice(start, endNew),
    end: endOld
  };
}

function Section(props) {
  const elements = Array.isArray(props.children) ? props.children : [props.children];
  const {
    headerItems,
    children
  } = elements.reduce((_, child) => {
    const bucket = child.type === Section.HeaderItem ? _.headerItems : _.children;
    bucket.push(child);
    return _;
  }, {
    headerItems: [],
    children: []
  });
  return jsxs("div", {
    class: "fjs-pgl-section",
    children: [jsxs("h1", {
      class: "header",
      children: [props.name, " ", headerItems.length ? jsx("span", {
        class: "header-items",
        children: headerItems
      }) : null]
    }), jsx("div", {
      class: "body",
      children: children
    })]
  });
}
Section.HeaderItem = function (props) {
  return props.children;
};

function PlaygroundRoot(config) {
  const {
    additionalModules,
    // goes into both editor + viewer
    actions: actionsConfig,
    emit,
    exporter: exporterConfig,
    viewerProperties,
    editorProperties,
    viewerAdditionalModules,
    editorAdditionalModules,
    propertiesPanel: propertiesPanelConfig,
    apiLinkTarget,
    onInit
  } = config;
  const {
    display: displayActions = true
  } = actionsConfig || {};
  const editorContainerRef = useRef();
  const paletteContainerRef = useRef();
  const propertiesPanelContainerRef = useRef();
  const viewerContainerRef = useRef();
  const inputDataContainerRef = useRef();
  const outputDataContainerRef = useRef();
  const formEditorRef = useRef();
  const formViewerRef = useRef();
  const inputDataRef = useRef();
  const outputDataRef = useRef();
  const [showEmbed, setShowEmbed] = useState(false);
  const [schema, setSchema] = useState();
  const [data, setData] = useState();
  const load = useCallback((schema, data) => {
    formEditorRef.current.importSchema(schema, data);
    inputDataRef.current.setValue(toString(data));
    setSchema(schema);
    setData(data);
  }, []);

  // initialize and link the editors
  useEffect(() => {
    const inputDataEditor = inputDataRef.current = new JSONEditor({
      contentAttributes: {
        'aria-label': 'Form Input',
        tabIndex: 0
      },
      placeholder: createDataEditorPlaceholder()
    });
    const outputDataEditor = outputDataRef.current = new JSONEditor({
      readonly: true,
      contentAttributes: {
        'aria-label': 'Form Output',
        tabIndex: 0
      }
    });
    const formViewer = formViewerRef.current = new Form({
      container: viewerContainerRef.current,
      additionalModules: [...(additionalModules || []), ...(viewerAdditionalModules || [])],
      properties: {
        ...(viewerProperties || {}),
        'ariaLabel': 'Form Preview'
      }
    });
    const formEditor = formEditorRef.current = new FormEditor({
      container: editorContainerRef.current,
      renderer: {
        compact: true
      },
      palette: {
        parent: paletteContainerRef.current
      },
      propertiesPanel: {
        parent: propertiesPanelContainerRef.current,
        ...(propertiesPanelConfig || {})
      },
      exporter: exporterConfig,
      properties: {
        ...(editorProperties || {}),
        'ariaLabel': 'Form Definition'
      },
      additionalModules: [...(additionalModules || []), ...(editorAdditionalModules || [])]
    });
    formEditor.on('formField.add', ({
      formField
    }) => {
      const formFields = formEditor.get('formFields');
      const {
        config
      } = formFields.get(formField.type);
      const {
        generateInitialDemoData
      } = config;
      const {
        id
      } = formField;
      if (!isFunction(generateInitialDemoData)) {
        return;
      }
      const initialDemoData = generateInitialDemoData(formField);
      if ([initialDemoData, id].includes(undefined)) {
        return;
      }
      setData(currentData => {
        const newData = {
          ...currentData,
          [id]: initialDemoData
        };
        inputDataRef.current.setValue(toString(newData));
        return newData;
      });
    });
    formEditor.on('changed', () => {
      setSchema(formEditor.getSchema());
    });
    formEditor.on('formEditor.rendered', () => {
      // notify interested parties after render
      emit('formPlayground.rendered');
    });

    // pipe viewer changes to output data editor
    formViewer.on('changed', () => {
      const submitData = formViewer._getSubmitData();
      outputDataEditor.setValue(toString(submitData));
    });
    inputDataEditor.on('changed', event => {
      try {
        setData(JSON.parse(event.value));
      } catch (error) {
        // notify interested about input data error
        emit('formPlayground.inputDataError', error);
      }
    });
    inputDataEditor.attachTo(inputDataContainerRef.current);
    outputDataEditor.attachTo(outputDataContainerRef.current);
    return () => {
      inputDataEditor.destroy();
      outputDataEditor.destroy();
      formViewer.destroy();
      formEditor.destroy();
    };
  }, [additionalModules, editorAdditionalModules, editorProperties, emit, exporterConfig, propertiesPanelConfig, viewerAdditionalModules, viewerProperties]);

  // initialize data through props
  useEffect(() => {
    if (!config.initialSchema) {
      return;
    }
    load(config.initialSchema, config.initialData || {});
  }, [config.initialSchema, config.initialData, load]);
  useEffect(() => {
    schema && formViewerRef.current.importSchema(schema, data);
  }, [schema, data]);
  useEffect(() => {
    if (schema && inputDataContainerRef.current) {
      const variables = getSchemaVariables(schema);
      inputDataRef.current.setVariables(variables);
    }
  }, [schema]);

  // exposes api to parent
  useEffect(() => {
    if (!apiLinkTarget) {
      return;
    }
    apiLinkTarget.api = {
      attachDataContainer: node => inputDataRef.current.attachTo(node),
      attachResultContainer: node => outputDataRef.current.attachTo(node),
      attachFormContainer: node => formViewerRef.current.attachTo(node),
      attachEditorContainer: node => formEditorRef.current.attachTo(node),
      attachPaletteContainer: node => formEditorRef.current.get('palette').attachTo(node),
      attachPropertiesPanelContainer: node => formEditorRef.current.get('propertiesPanel').attachTo(node),
      get: (name, strict) => formEditorRef.current.get(name, strict),
      getDataEditor: () => inputDataRef.current,
      getEditor: () => formEditorRef.current,
      getForm: () => formViewerRef.current,
      getResultView: () => outputDataRef.current,
      getSchema: () => formEditorRef.current.getSchema(),
      saveSchema: () => formEditorRef.current.saveSchema(),
      setSchema: setSchema,
      setData: setData
    };
    onInit();
  }, [apiLinkTarget, onInit]);

  // separate effect for state to avoid re-creating the api object every time
  useEffect(() => {
    if (!apiLinkTarget) {
      return;
    }
    apiLinkTarget.api.getState = () => ({
      schema,
      data
    });
    apiLinkTarget.api.load = load;
  }, [apiLinkTarget, schema, data, load]);
  const handleDownload = useCallback(() => {
    download(JSON.stringify(schema, null, '  '), 'form.json', 'text/json');
  }, [schema]);
  const hideEmbedModal = useCallback(() => {
    setShowEmbed(false);
  }, []);

  // const showEmbedModal = useCallback(() => {
  //   setShowEmbed(true);
  // }, []);

  return jsxs("div", {
    class: classNames('fjs-container', 'fjs-pgl-root'),
    children: [jsx("div", {
      class: "fjs-pgl-modals",
      children: showEmbed ? jsx(EmbedModal, {
        schema: schema,
        data: data,
        onClose: hideEmbedModal
      }) : null
    }), jsx("div", {
      class: "fjs-pgl-palette-container",
      ref: paletteContainerRef
    }), jsxs("div", {
      class: "fjs-pgl-main",
      children: [jsxs(Section, {
        name: "Definice formul\xE1\u0159e",
        children: [displayActions && jsx(Section.HeaderItem, {
          children: jsx("button", {
            type: "button",
            class: "fjs-pgl-button",
            title: "St\xE1hnout vstupn\xED sch\xE9ma v JSON form\xE1tu",
            onClick: handleDownload,
            children: "St\xE1hnout"
          })
        }), jsx("div", {
          ref: editorContainerRef,
          class: "fjs-pgl-form-container"
        })]
      }), jsx(Section, {
        name: "N\xE1hled formul\xE1\u0159e",
        children: jsx("div", {
          ref: viewerContainerRef,
          class: "fjs-pgl-form-container"
        })
      }), jsx(Section, {
        name: "Vstupn\xED sch\xE9ma",
        children: jsx("div", {
          ref: inputDataContainerRef,
          class: "fjs-pgl-text-container"
        })
      }), jsx(Section, {
        name: "V\xFDstupn\xED sch\xE9ma",
        children: jsx("div", {
          ref: outputDataContainerRef,
          class: "fjs-pgl-text-container"
        })
      })]
    }), jsx("div", {
      class: "fjs-pgl-properties-container",
      ref: propertiesPanelContainerRef
    })]
  });
}

// helpers ///////////////

function toString(obj) {
  return JSON.stringify(obj, null, '  ');
}
function createDataEditorPlaceholder() {
  const element = document.createElement('p');
  element.innerHTML = 'Use this panel to simulate the form input, such as process variables.\nThis helps to test the form by populating the preview.\n\n' + 'Follow the JSON format like this:\n\n' + '{\n  "variable": "value"\n}';
  return element;
}

function Playground(options) {
  const {
    container: parent,
    schema: initialSchema,
    data: initialData,
    ...rest
  } = options;
  const emitter = mitt();
  const container = document.createElement('div');
  container.classList.add('fjs-pgl-parent');
  if (parent) {
    parent.appendChild(container);
  }
  const handleDrop = fileDrop('Drop a form file', function (files) {
    const file = files[0];
    if (file) {
      try {
        this.api.setSchema(JSON.parse(file.contents));
      } catch (err) {

        // TODO(nikku): indicate JSON parse error
      }
    }
  });
  const safe = function (fn) {
    return function (...args) {
      if (!this.api) {
        throw new Error('Playground is not initialized.');
      }
      return fn(...args);
    };
  };
  const onInit = function () {
    emitter.emit('formPlayground.init');
  };
  container.addEventListener('dragover', handleDrop);
  render(jsx(PlaygroundRoot, {
    initialSchema: initialSchema,
    initialData: initialData,
    emit: emitter.emit,
    apiLinkTarget: this,
    onInit: onInit,
    ...rest
  }), container);
  this.on = emitter.on;
  this.off = emitter.off;
  this.emit = emitter.emit;
  this.on('destroy', () => {
    render(null, container);
    parent.removeChild(container);
  });
  this.destroy = () => this.emit('destroy');
  this.getState = safe(() => this.api.getState());
  this.getSchema = safe(() => this.api.getSchema());
  this.setSchema = safe(schema => this.api.setSchema(schema));
  this.saveSchema = safe(() => this.api.saveSchema());
  this.get = safe((name, strict) => this.api.get(name, strict));
  this.getDataEditor = safe(() => this.api.getDataEditor());
  this.getEditor = safe(() => this.api.getEditor());
  this.getForm = safe((name, strict) => this.api.getForm(name, strict));
  this.getResultView = safe(() => this.api.getResultView());
  this.attachEditorContainer = safe(node => this.api.attachEditorContainer(node));
  this.attachPreviewContainer = safe(node => this.api.attachFormContainer(node));
  this.attachDataContainer = safe(node => this.api.attachDataContainer(node));
  this.attachResultContainer = safe(node => this.api.attachResultContainer(node));
  this.attachPaletteContainer = safe(node => this.api.attachPaletteContainer(node));
  this.attachPropertiesPanelContainer = safe(node => this.api.attachPropertiesPanelContainer(node));
}

export { Playground };
//# sourceMappingURL=index.es.js.map
