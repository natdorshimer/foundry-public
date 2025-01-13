/**
 * @callback CustomFormGroup
 * @param {DataField} field
 * @param {FormGroupConfig} groupConfig
 * @param {FormInputConfig} inputConfig
 * @returns {HTMLDivElement}
 */

/**
 * @callback CustomFormInput
 * @param {DataField} field
 * @param {FormInputConfig} config
 * @returns {HTMLElement|HTMLCollection}
 */

/**
 * @typedef {Object} FormGroupConfig
 * @property {string} label                       A text label to apply to the form group
 * @property {string} [units]                     An optional units string which is appended to the label
 * @property {HTMLElement|HTMLCollection} input   An HTML element or collection of elements which provide the inputs
 *                                                for the group
 * @property {string} [hint]                      Hint text displayed as part of the form group
 * @property {string} [rootId]                    Some parent CSS id within which field names are unique. If provided,
 *                                                this root ID is used to automatically assign "id" attributes to input
 *                                                elements and "for" attributes to corresponding labels
 * @property {string[]} [classes]                 An array of CSS classes applied to the form group element
 * @property {boolean} [stacked=false]            Is the "stacked" class applied to the form group
 * @property {boolean} [localize=false]           Should labels or other elements within this form group be
 *                                                automatically localized?
 * @property {CustomFormGroup} [widget]           A custom form group widget function which replaces the default
 *                                                group HTML generation
 */

/**
 * @template FormInputValue
 * @typedef {Object} FormInputConfig
 * @property {string} name                        The name of the form element
 * @property {FormInputValue} [value]             The current value of the form element
 * @property {boolean} [required=false]           Is the field required?
 * @property {boolean} [disabled=false]           Is the field disabled?
 * @property {boolean} [readonly=false]           Is the field readonly?
 * @property {boolean} [autofocus=false]          Is the field autofocused?
 * @property {boolean} [localize=false]           Localize values of this field?
 * @property {Record<string,string>} [dataset]    Additional dataset attributes to assign to the input
 * @property {string} [placeholder]               A placeholder value, if supported by the element type
 * @property {CustomFormInput} [input]
 */

/**
 * Create a standardized form field group.
 * @param {FormGroupConfig} config
 * @returns {HTMLDivElement}
 */
export function createFormGroup(config) {
  let {classes, hint, label, input, rootId, stacked, localize, units} = config;
  classes ||= [];
  if ( stacked ) classes.unshift("stacked");
  classes.unshift("form-group");

  // Assign identifiers to each input
  input = input instanceof HTMLCollection ? input : [input];
  let labelFor;
  if ( rootId ) {
    for ( const [i, el] of input.entries() ) {
      const id = [rootId, el.name, input.length > 1 ? i : ""].filterJoin("-");
      labelFor ||= id;
      el.setAttribute("id", id);
    }
  }

  // Create the group element
  const group = document.createElement("div");
  group.className = classes.join(" ");

  // Label element
  const lbl = document.createElement("label");
  lbl.innerText = localize ? game.i18n.localize(label) : label;
  if ( labelFor ) lbl.setAttribute("for", labelFor);
  if ( units ) lbl.insertAdjacentHTML("beforeend", ` <span class="units">(${game.i18n.localize(units)})</span>`);
  group.prepend(lbl);

  // Form fields and inputs
  const fields = document.createElement("div");
  fields.className = "form-fields";
  fields.append(...input);
  group.append(fields);

  // Hint element
  if ( hint ) {
    const h = document.createElement("p");
    h.className = "hint";
    h.innerText = localize ? game.i18n.localize(hint) : hint;
    group.append(h);
  }
  return group;
}

/* ---------------------------------------- */

/**
 * Create an `<input type="checkbox">` element for a BooleanField.
 * @param {FormInputConfig<boolean>} config
 * @returns {HTMLInputElement}
 */
export function createCheckboxInput(config) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = config.name;
  if ( config.value ) input.setAttribute("checked", "");
  setInputAttributes(input, config);
  return input;
}

/* ---------------------------------------- */

/**
 * @typedef {Object} EditorInputConfig
 * @property {string} [engine="prosemirror"]
 * @property {number} [height]
 * @property {boolean} [editable=true]
 * @property {boolean} [button=false]
 * @property {boolean} [collaborate=false]
 */

/**
 * Create a `<div class="editor">` element for a StringField.
 * @param {FormInputConfig<string> & EditorInputConfig} config
 * @returns {HTMLDivElement}
 */
export function createEditorInput(config) {
  const {engine="prosemirror", editable=true, button=false, collaborate=false, height} = config;
  const editor = document.createElement("div");
  editor.className = "editor";
  if ( height !== undefined ) editor.style.height = `${height}px`;

  // Dataset attributes
  let dataset = { engine, collaborate };
  if ( editable ) dataset.edit = config.name;
  dataset = Object.entries(dataset).map(([k, v]) => `data-${k}="${v}"`).join(" ");

  // Editor HTML
  let editorHTML = "";
  if ( button && editable ) editorHTML += '<a class="editor-edit"><i class="fa-solid fa-edit"></i></a>';
  editorHTML += `<div class="editor-content" ${dataset}>${config.value ?? ""}</div>`;
  editor.innerHTML = editorHTML;
  return editor;
}

/* ---------------------------------------- */

/**
 * Create a `<multi-select>` element for a StringField.
 * @param {FormInputConfig<string[]> & Omit<SelectInputConfig, "blank">} config
 * @returns {HTMLSelectElement}
 */
export function createMultiSelectInput(config) {
  const tagName = config.type === "checkboxes" ? "multi-checkbox" : "multi-select";
  const select = document.createElement(tagName);
  select.name = config.name;
  setInputAttributes(select, config);
  const groups = prepareSelectOptionGroups(config);
  for ( const g of groups ) {
    let parent = select;
    if ( g.group ) parent = _appendOptgroup(g.group, select);
    for ( const o of g.options ) _appendOption(o, parent);
  }
  return select;
}

/* ---------------------------------------- */

/**
 * @typedef {Object} NumberInputConfig
 * @property {number} min
 * @property {number} max
 * @property {number|"any"} step
 * @property {"range"|"number"} [type]
 */

/**
 * Create an `<input type="number">` element for a NumberField.
 * @param {FormInputConfig<number> & NumberInputConfig} config
 * @returns {HTMLInputElement}
 */
export function createNumberInput(config) {
  const input = document.createElement("input");
  input.type = "number";
  if ( config.name ) input.name = config.name;

  // Assign value
  let step = typeof config.step === "number" ? config.step : "any";
  let value = config.value;
  if ( Number.isNumeric(value) ) {
    if ( typeof config.step === "number" ) value = value.toNearest(config.step);
    input.setAttribute("value", String(value));
  }
  else input.setAttribute("value", "");

  // Min, max, and step size
  if ( typeof config.min === "number" ) input.setAttribute("min", String(config.min));
  if ( typeof config.max === "number" ) input.setAttribute("max", String(config.max));
  input.setAttribute("step", String(step));
  setInputAttributes(input, config);
  return input;
}

/* ---------------------------------------- */

/**
 * @typedef {Object} FormSelectOption
 * @property {string} [value]
 * @property {string} [label]
 * @property {string} [group]
 * @property {boolean} [disabled]
 * @property {boolean} [selected]
 * @property {boolean} [rule]
 */

/**
 * @typedef {Object} SelectInputConfig
 * @property {FormSelectOption[]} options
 * @property {string[]} [groups]        An option to control the order and display of optgroup elements. The order of
 *                                      strings defines the displayed order of optgroup elements.
 *                                      A blank string may be used to define the position of ungrouped options.
 *                                      If not defined, the order of groups corresponds to the order of options.
 * @property {string} [blank]
 * @property {string} [valueAttr]       An alternative value key of the object passed to the options array
 * @property {string} [labelAttr]       An alternative label key of the object passed to the options array
 * @property {boolean} [localize=false] Localize value labels
 * @property {boolean} [sort=false]     Sort options alphabetically by label within groups
 * @property {"single"|"multi"|"checkboxes"} [type] Customize the type of select that is created
 */

/**
 * Create a `<select>` element for a StringField.
 * @param {FormInputConfig<string> & SelectInputConfig} config
 * @returns {HTMLSelectElement}
 */
export function createSelectInput(config) {
  const select = document.createElement("select");
  select.name = config.name;
  setInputAttributes(select, config);
  const groups = prepareSelectOptionGroups(config);
  for ( const g of groups ) {
    let parent = select;
    if ( g.group ) parent = _appendOptgroup(g.group, select);
    for ( const o of g.options ) _appendOption(o, parent);
  }
  return select;
}

/* ---------------------------------------- */

/**
 * @typedef {Object} TextAreaInputConfig
 * @property {number} rows
 */

/**
 * Create a `<textarea>` element for a StringField.
 * @param {FormInputConfig<string> & TextAreaInputConfig} config
 * @returns {HTMLTextAreaElement}
 */
export function createTextareaInput(config) {
  const textarea = document.createElement("textarea");
  textarea.name = config.name;
  textarea.textContent = config.value ?? "";
  if ( config.rows ) textarea.setAttribute("rows", String(config.rows));
  setInputAttributes(textarea, config);
  return textarea;
}

/* ---------------------------------------- */

/**
 * Create an `<input type="text">` element for a StringField.
 * @param {FormInputConfig<string>} config
 * @returns {HTMLInputElement}
 */
export function createTextInput(config) {
  const input = document.createElement("input");
  input.type = "text";
  input.name = config.name;
  input.setAttribute("value", config.value ?? "");
  setInputAttributes(input, config);
  return input;
}

/* ---------------------------------------- */
/*  Helper Methods                          */
/* ---------------------------------------- */

/**
 * Structure a provided array of select options into a standardized format for rendering optgroup and option elements.
 * @param {FormInputConfig & SelectInputConfig} config
 * @returns {{group: string, options: FormSelectOption[]}[]}
 *
 * @example
 * const options = [
 *   {value: "bar", label: "Bar", selected: true, group: "Good Options"},
 *   {value: "foo", label: "Foo", disabled: true, group: "Bad Options"},
 *   {value: "baz", label: "Baz", group: "Good Options"}
 * ];
 * const groups = ["Good Options", "Bad Options", "Unused Options"];
 * const optgroups = foundry.applications.fields.prepareSelectOptionGroups({options, groups, blank: true, sort: true});
 */
export function prepareSelectOptionGroups(config) {

  // Coerce values to string array
  let values = [];
  if ( (config.value === undefined) || (config.value === null) ) values = [];
  else if ( typeof config.value === "object" ) {
    for ( const v of config.value ) values.push(String(v));
  }
  else values = [String(config.value)];
  const isSelected = value => values.includes(value);

  // Organize options into groups
  let hasBlank = false;
  const groups = {};
  for ( const option of (config.options || []) ) {
    let {group, value, label, disabled, rule} = option;

    // Value
    if ( config.valueAttr ) value = option[config.valueAttr];
    if ( value !== undefined ) {
      value = String(value);
      if ( value === "" ) hasBlank = true;
    }

    // Label
    if ( config.labelAttr ) label = option[config.labelAttr];
    label ??= value;
    if ( label !== undefined ) {
      if ( typeof label !== "string" ) label = label.toString();
      if ( config.localize ) label = game.i18n.localize(label);
    }

    const selected = option.selected || isSelected(value);
    disabled = !!disabled;

    // Add to group
    group ||= "";
    groups[group] ||= [];
    groups[group].push({type: "option", value, label, selected, disabled, rule})
  }

  // Add groups into an explicitly desired order
  const result = [];
  if ( config.groups instanceof Array ) {
    for ( let group of config.groups ) {
      const options = groups[group] ?? [];
      delete groups[group];
      if ( config.localize ) group = game.i18n.localize(group);
      result.push({group, options});
    }
  }

  // Add remaining groups
  for ( let [groupName, options] of Object.entries(groups) ) {
    if ( groupName && config.localize ) groupName = game.i18n.localize(groupName);
    result.push({group: groupName, options});
  }

  // Sort options
  if ( config.sort ) {
    for ( const group of result ) group.options.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
  }

  // A blank option always comes first
  if ( (typeof config.blank === "string") && !hasBlank ) result.unshift({group: "", options: [{
    value: "",
    label: config.localize ? game.i18n.localize(config.blank) : config.blank,
    selected: isSelected("")
  }]});
  return result;
}

/* ---------------------------------------- */

/**
 * Create and append an option element to a parent select or optgroup.
 * @param {FormSelectOption} option
 * @param {HTMLSelectElement|HTMLOptGroupElement} parent
 * @internal
 */
function _appendOption(option, parent) {
  const { value, label, selected, disabled, rule } = option;
  if ( (value !== undefined) && (label !== undefined) ) {
    const o = document.createElement("option");
    o.value = value;
    o.innerText = label;
    if ( selected ) o.toggleAttribute("selected", true);
    if ( disabled ) o.toggleAttribute("disabled", true);
    parent.appendChild(o);
  }
  if ( rule ) parent.insertAdjacentHTML("beforeend", "<hr>");
}

/* ---------------------------------------- */

/**
 * Create and append an optgroup element to a parent select.
 * @param {string} label
 * @param {HTMLSelectElement} parent
 * @returns {HTMLOptGroupElement}
 * @internal
 */
function _appendOptgroup(label, parent) {
  const g = document.createElement("optgroup");
  g.label = label;
  parent.appendChild(g);
  return g;
}

/* ---------------------------------------- */

/**
 * Apply standard attributes to all input elements.
 * @param {HTMLElement} input           The element being configured
 * @param {FormInputConfig<*>} config   Configuration for the element
 */
export function setInputAttributes(input, config) {
  input.toggleAttribute("required", config.required === true);
  input.toggleAttribute("disabled", config.disabled === true);
  input.toggleAttribute("readonly", config.readonly === true);
  input.toggleAttribute("autofocus", config.autofocus === true);
  if ( config.placeholder ) input.setAttribute("placeholder", config.placeholder);
  if ( "dataset" in config ) {
    for ( const [k, v] of Object.entries(config.dataset) ) {
      input.dataset[k] = v;
    }
  }
}
