
/* -------------------------------------------- */
/*  HTML Template Loading                       */
/* -------------------------------------------- */

/**
 * Get a template from the server by fetch request and caching the retrieved result
 * @param {string} path           The web-accessible HTML template URL
 * @param {string} [id]           An ID to register the partial with.
 * @returns {Promise<Function>}   A Promise which resolves to the compiled Handlebars template
 */
async function getTemplate(path, id) {
  if ( path in Handlebars.partials ) return Handlebars.partials[path];
  const htmlString = await new Promise((resolve, reject) => {
    game.socket.emit("template", path, resp => {
      if ( resp.error ) return reject(new Error(resp.error));
      return resolve(resp.html);
    });
  });
  const compiled = Handlebars.compile(htmlString);
  Handlebars.registerPartial(id ?? path, compiled);
  console.log(`Foundry VTT | Retrieved and compiled template ${path}`);
  return compiled;
}

/* -------------------------------------------- */

/**
 * Load and cache a set of templates by providing an Array of paths
 * @param {string[]|Record<string, string>} paths  An array of template file paths to load, or an object of Handlebars partial
 *                                         IDs to paths.
 * @returns {Promise<Function[]>}
 *
 * @example Loading a list of templates.
 * ```js
 * await loadTemplates(["templates/apps/foo.html", "templates/apps/bar.html"]);
 * ```
 * ```hbs
 * <!-- Include a pre-loaded template as a partial -->
 * {{> "templates/apps/foo.html" }}
 * ```
 *
 * @example Loading an object of templates.
 * ```js
 * await loadTemplates({
 *   foo: "templates/apps/foo.html",
 *   bar: "templates/apps/bar.html"
 * });
 * ```
 * ```hbs
 * <!-- Include a pre-loaded template as a partial -->
 * {{> foo }}
 * ```
 */
async function loadTemplates(paths) {
  let promises;
  if ( foundry.utils.getType(paths) === "Object" ) promises = Object.entries(paths).map(([k, p]) => getTemplate(p, k));
  else promises = paths.map(p => getTemplate(p));
  return Promise.all(promises);
}

/* -------------------------------------------- */


/**
 * Get and render a template using provided data and handle the returned HTML
 * Support asynchronous file template file loading with a client-side caching layer
 *
 * Allow resolution of prototype methods and properties since this all occurs within the safety of the client.
 * @see {@link https://handlebarsjs.com/api-reference/runtime-options.html#options-to-control-prototype-access}
 *
 * @param {string} path             The file path to the target HTML template
 * @param {Object} data             A data object against which to compile the template
 *
 * @returns {Promise<string>}        Returns the compiled and rendered template as a string
 */
async function renderTemplate(path, data) {
  const template = await getTemplate(path);
  return template(data || {}, {
    allowProtoMethodsByDefault: true,
    allowProtoPropertiesByDefault: true
  });
}


/* -------------------------------------------- */
/*  Handlebars Template Helpers                 */
/* -------------------------------------------- */

// Register Handlebars Extensions
HandlebarsIntl.registerWith(Handlebars);

/**
 * A collection of Handlebars template helpers which can be used within HTML templates.
 */
class HandlebarsHelpers {

  /**
   * For checkboxes, if the value of the checkbox is true, add the "checked" property, otherwise add nothing.
   * @returns {string}
   *
   * @example
   * ```hbs
   * <label>My Checkbox</label>
   * <input type="checkbox" name="myCheckbox" {{checked myCheckbox}}>
   * ```
   */
  static checked(value) {
    return Boolean(value) ? "checked" : "";
  }

  /* -------------------------------------------- */

  /**
   * For use in form inputs. If the supplied value is truthy, add the "disabled" property, otherwise add nothing.
   * @returns {string}
   *
   * @example
   * ```hbs
   * <button type="submit" {{disabled myValue}}>Submit</button>
   * ```
   */
  static disabled(value) {
    return value ? "disabled" : "";
  }

  /* -------------------------------------------- */

  /**
   * Concatenate a number of string terms into a single string.
   * This is useful for passing arguments with variable names.
   * @param {string[]} values             The values to concatenate
   * @returns {Handlebars.SafeString}
   *
   * @example Concatenate several string parts to create a dynamic variable
   * ```hbs
   * {{filePicker target=(concat "faces." i ".img") type="image"}}
   * ```
   */
  static concat(...values) {
    const options = values.pop();
    const join = options.hash?.join || "";
    return new Handlebars.SafeString(values.join(join));
  }

  /* -------------------------------------------- */

  /**
   * Construct an editor element for rich text editing with TinyMCE or ProseMirror.
   * @param {string} content                       The content to display and edit.
   * @param {object} [options]
   * @param {string} [options.target]              The named target data element
   * @param {boolean} [options.button]             Include a button used to activate the editor later?
   * @param {string} [options.class]               A specific CSS class to add to the editor container
   * @param {boolean} [options.editable=true]      Is the text editor area currently editable?
   * @param {string} [options.engine=tinymce]      The editor engine to use, see {@link TextEditor.create}.
   * @param {boolean} [options.collaborate=false]  Whether to turn on collaborative editing features for ProseMirror.
   * @returns {Handlebars.SafeString}
   *
   * @example
   * ```hbs
   * {{editor world.description target="description" button=false engine="prosemirror" collaborate=false}}
   * ```
   */
  static editor(content, options) {
    const { target, editable=true, button, engine="tinymce", collaborate=false, class: cssClass } = options.hash;
    const config = {name: target, value: content, button, collaborate, editable, engine};
    const element = foundry.applications.fields.createEditorInput(config);
    if ( cssClass ) element.querySelector(".editor-content").classList.add(cssClass);
    return new Handlebars.SafeString(element.outerHTML);
  }

  /* -------------------------------------------- */

  /**
   * A ternary expression that allows inserting A or B depending on the value of C.
   * @param {boolean} criteria    The test criteria
   * @param {string} ifTrue       The string to output if true
   * @param {string} ifFalse      The string to output if false
   * @returns {string}            The ternary result
   *
   * @example Ternary if-then template usage
   * ```hbs
   * {{ifThen true "It is true" "It is false"}}
   * ```
   */
  static ifThen(criteria, ifTrue, ifFalse) {
    return criteria ? ifTrue : ifFalse;
  }

  /* -------------------------------------------- */

  /**
   * Translate a provided string key by using the loaded dictionary of localization strings.
   * @returns {string}
   *
   * @example Translate a provided localization string, optionally including formatting parameters
   * ```hbs
   * <label>{{localize "ACTOR.Create"}}</label> <!-- "Create Actor" -->
   * <label>{{localize "CHAT.InvalidCommand" command=foo}}</label> <!-- "foo is not a valid chat message command." -->
   * ```
   */
  static localize(value, options) {
    if ( value instanceof Handlebars.SafeString ) value = value.toString();
    const data = options.hash;
    return foundry.utils.isEmpty(data) ? game.i18n.localize(value) : game.i18n.format(value, data);
  }

  /* -------------------------------------------- */

  /**
   * A string formatting helper to display a number with a certain fixed number of decimals and an explicit sign.
   * @param {number|string} value       A numeric value to format
   * @param {object} options            Additional options which customize the resulting format
   * @param {number} [options.decimals=0]   The number of decimal places to include in the resulting string
   * @param {boolean} [options.sign=false]  Whether to include an explicit "+" sign for positive numbers   *
   * @returns {Handlebars.SafeString}   The formatted string to be included in a template
   *
   * @example
   * ```hbs
   * {{formatNumber 5.5}} <!-- 5.5 -->
   * {{formatNumber 5.5 decimals=2}} <!-- 5.50 -->
   * {{formatNumber 5.5 decimals=2 sign=true}} <!-- +5.50 -->
   * {{formatNumber null decimals=2 sign=false}} <!-- NaN -->
   * {{formatNumber undefined decimals=0 sign=true}} <!-- NaN -->
   *  ```
   */
  static numberFormat(value, options) {
    const originalValue = value;
    const dec = options.hash.decimals ?? 0;
    const sign = options.hash.sign || false;
    if ( (typeof value === "string") || (value == null) ) value = parseFloat(value);
    if ( Number.isNaN(value) ) {
      console.warn("An invalid value was passed to numberFormat:", {
        originalValue,
        valueType: typeof originalValue,
        options
      });
    }
    let strVal = sign && (value >= 0) ? `+${value.toFixed(dec)}` : value.toFixed(dec);
    return new Handlebars.SafeString(strVal);
  }

  /* --------------------------------------------- */

  /**
   * Render a form input field of type number with value appropriately rounded to step size.
   * @param {number} value
   * @param {FormInputConfig<number> & NumberInputConfig} options
   * @returns {Handlebars.SafeString}
   *
   * @example
   * ```hbs
   * {{numberInput value name="numberField" step=1 min=0 max=10}}
   * ```
   */
  static numberInput(value, options) {
    const {class: cssClass, ...config} = options.hash;
    config.value = value;
    const element = foundry.applications.fields.createNumberInput(config);
    if ( cssClass ) element.className = cssClass;
    return new Handlebars.SafeString(element.outerHTML);
  }

  /* -------------------------------------------- */

  /**
   * A helper to create a set of radio checkbox input elements in a named set.
   * The provided keys are the possible radio values while the provided values are human readable labels.
   *
   * @param {string} name         The radio checkbox field name
   * @param {object} choices      A mapping of radio checkbox values to human readable labels
   * @param {object} options      Options which customize the radio boxes creation
   * @param {string} options.checked    Which key is currently checked?
   * @param {boolean} options.localize  Pass each label through string localization?
   * @returns {Handlebars.SafeString}
   *
   * @example The provided input data
   * ```js
   * let groupName = "importantChoice";
   * let choices = {a: "Choice A", b: "Choice B"};
   * let chosen = "a";
   * ```
   *
   * @example The template HTML structure
   * ```hbs
   * <div class="form-group">
   *   <label>Radio Group Label</label>
   *   <div class="form-fields">
   *     {{radioBoxes groupName choices checked=chosen localize=true}}
   *   </div>
   * </div>
   * ```
   */
  static radioBoxes(name, choices, options) {
    const checked = options.hash['checked'] || null;
    const localize = options.hash['localize'] || false;
    let html = "";
    for ( let [key, label] of Object.entries(choices) ) {
      if ( localize ) label = game.i18n.localize(label);
      const isChecked = checked === key;
      html += `<label class="checkbox"><input type="radio" name="${name}" value="${key}" ${isChecked ? "checked" : ""}> ${label}</label>`;
    }
    return new Handlebars.SafeString(html);
  }

  /* -------------------------------------------- */

  /**
   * Render a pair of inputs for selecting a value in a range.
   * @param {object} options            Helper options
   * @param {string} [options.name]     The name of the field to create
   * @param {number} [options.value]    The current range value
   * @param {number} [options.min]      The minimum allowed value
   * @param {number} [options.max]      The maximum allowed value
   * @param {number} [options.step]     The allowed step size
   * @returns {Handlebars.SafeString}
   *
   * @example
   * ```hbs
   * {{rangePicker name="foo" value=bar min=0 max=10 step=1}}
   * ```
   */
  static rangePicker(options) {
    let {name, value, min, max, step} = options.hash;
    name = name || "range";
    value = value ?? "";
    if ( Number.isNaN(value) ) value = "";
    const html =
    `<input type="range" name="${name}" value="${value}" min="${min}" max="${max}" step="${step}"/>
     <span class="range-value">${value}</span>`;
    return new Handlebars.SafeString(html);
  }

  /* -------------------------------------------- */

  /**
   * @typedef {Object} SelectOptionsHelperOptions
   * @property {boolean} invert     Invert the key/value order of a provided choices object
   * @property {string|string[]|Set<string>} selected  The currently selected value or values
   */

  /**
   * A helper to create a set of &lt;option> elements in a &lt;select> block based on a provided dictionary.
   * The provided keys are the option values while the provided values are human-readable labels.
   * This helper supports both single-select and multi-select input fields.
   *
   * @param {object|Array<object>} choices       A mapping of radio checkbox values to human-readable labels
   * @param {SelectInputConfig & SelectOptionsHelperOptions} options  Options which configure how select options are
   *                                            generated by the helper
   * @returns {Handlebars.SafeString}           Generated HTML safe for rendering into a Handlebars template
   *
   * @example The provided input data
   * ```js
   * let choices = {a: "Choice A", b: "Choice B"};
   * let value = "a";
   * ```
   * The template HTML structure
   * ```hbs
   * <select name="importantChoice">
   *   {{selectOptions choices selected=value localize=true}}
   * </select>
   * ```
   * The resulting HTML
   * ```html
   * <select name="importantChoice">
   *   <option value="a" selected>Choice A</option>
   *   <option value="b">Choice B</option>
   * </select>
   * ```
   *
   * @example Using inverted choices
   * ```js
   * let choices = {"Choice A": "a", "Choice B": "b"};
   * let value = "a";
   * ```
   *  The template HTML structure
   *  ```hbs
   * <select name="importantChoice">
   *   {{selectOptions choices selected=value inverted=true}}
   * </select>
   * ```
   *
   * @example Using nameAttr and labelAttr with objects
   * ```js
   * let choices = {foo: {key: "a", label: "Choice A"}, bar: {key: "b", label: "Choice B"}};
   * let value = "b";
   * ```
   * The template HTML structure
   * ```hbs
   * <select name="importantChoice">
   *   {{selectOptions choices selected=value nameAttr="key" labelAttr="label"}}
   * </select>
   * ```
   *
   * @example Using nameAttr and labelAttr with arrays
   * ```js
   * let choices = [{key: "a", label: "Choice A"}, {key: "b", label: "Choice B"}];
   * let value = "b";
   * ```
   * The template HTML structure
   * ```hbs
   * <select name="importantChoice">
   *   {{selectOptions choices selected=value nameAttr="key" labelAttr="label"}}
   * </select>
   * ```
   */
  static selectOptions(choices, options) {
    let {localize=false, selected, blank, sort, nameAttr, valueAttr, labelAttr, inverted, groups} = options.hash;
    if ( (selected === undefined) || (selected === null) ) selected = [];
    else if ( !(selected instanceof Array) ) selected = [selected];

    if ( nameAttr && !valueAttr ) {
      foundry.utils.logCompatibilityWarning(`The "nameAttr" property of the {{selectOptions}} handlebars helper is 
        renamed to "valueAttr" for consistency with other methods.`, {since: 12, until: 14});
      valueAttr = nameAttr;
    }

    // Prepare the choices as an array of objects
    const selectOptions = [];
    if ( choices instanceof Array ) {
      for ( const [i, choice] of choices.entries() ) {
        if ( typeof choice === "object" ) selectOptions.push(choice);
        else selectOptions.push({value: i, label: choice});
      }
    }

    // Object of keys and values
    else {
      for ( const choice of Object.entries(choices) ) {
        const [k, v] = inverted ? choice.reverse() : choice;
        const value = valueAttr ? v[valueAttr] : k;
        if ( typeof v === "object" ) selectOptions.push({value, ...v});
        else selectOptions.push({value, label: v});
      }
    }

    // Delegate to new fields helper
    const select = foundry.applications.fields.createSelectInput({
      options: selectOptions,
      value: selected,
      blank,
      groups,
      labelAttr,
      localize,
      sort,
      valueAttr
    });
    return new Handlebars.SafeString(select.innerHTML);
  }

  /* -------------------------------------------- */

  /**
   * Convert a DataField instance into an HTML input fragment.
   * @param {DataField} field             The DataField instance to convert to an input
   * @param {object} options              Helper options
   * @returns {Handlebars.SafeString}
   */
  static formInput(field, options) {
    const input = field.toInput(options.hash);
    return new Handlebars.SafeString(input.outerHTML);
  }

  /* -------------------------------------------- */

  /**
   * Convert a DataField instance into an HTML input fragment.
   * @param {DataField} field             The DataField instance to convert to an input
   * @param {object} options              Helper options
   * @returns {Handlebars.SafeString}
   */
  static formGroup(field, options) {
    const {classes, label, hint, rootId, stacked, units, widget, ...inputConfig} = options.hash;
    const groupConfig = {label, hint, rootId, stacked, widget, localize: inputConfig.localize, units,
      classes: typeof classes === "string" ? classes.split(" ") : []};
    const group = field.toFormGroup(groupConfig, inputConfig);
    return new Handlebars.SafeString(group.outerHTML);
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  static filePicker(options) {
    foundry.utils.logCompatibilityWarning("The {{filePicker}} Handlebars helper is deprecated and replaced by"
      + " use of the <file-picker> custom HTML element", {since: 12, until: 14, once: true});
    const type = options.hash.type;
    const target = options.hash.target;
    if ( !target ) throw new Error("You must define the name of the target field.");
    if ( game.world && !game.user.can("FILES_BROWSE" ) ) return "";
    const tooltip = game.i18n.localize("FILES.BrowseTooltip");
    return new Handlebars.SafeString(`
    <button type="button" class="file-picker" data-type="${type}" data-target="${target}" title="${tooltip}" tabindex="-1">
        <i class="fas fa-file-import fa-fw"></i>
    </button>`);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  static colorPicker(options) {
    foundry.utils.logCompatibilityWarning("The {{colorPicker}} Handlebars helper is deprecated and replaced by"
      + " use of the <color-picker> custom HTML element", {since: 12, until: 14, once: true});
    let {name, default: defaultColor, value} = options.hash;
    name = name || "color";
    value = value || defaultColor || "";
    const htmlString = `<color-picker name="${name}" value="${value}"></color-picker>`;
    return new Handlebars.SafeString(htmlString);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  static select(selected, options) {
    foundry.utils.logCompatibilityWarning("The {{select}} handlebars helper is deprecated in favor of using the "
      + "{{selectOptions}} helper or the foundry.applications.fields.createSelectInput, "
      + "foundry.applications.fields.createMultiSelectElement, or "
      + "foundry.applications.fields.prepareSelectOptionGroups methods.", {since: 12, until: 14});
    const escapedValue = RegExp.escape(Handlebars.escapeExpression(selected));
    const rgx = new RegExp(` value=[\"']${escapedValue}[\"\']`);
    const html = options.fn(this);
    return html.replace(rgx, "$& selected");
  }
}

// Register all handlebars helpers
Handlebars.registerHelper({
  checked: HandlebarsHelpers.checked,
  disabled: HandlebarsHelpers.disabled,
  colorPicker: HandlebarsHelpers.colorPicker,
  concat: HandlebarsHelpers.concat,
  editor: HandlebarsHelpers.editor,
  formInput: HandlebarsHelpers.formInput,
  formGroup: HandlebarsHelpers.formGroup,
  formField: HandlebarsHelpers.formGroup, // Alias
  filePicker: HandlebarsHelpers.filePicker,
  ifThen: HandlebarsHelpers.ifThen,
  numberFormat: HandlebarsHelpers.numberFormat,
  numberInput: HandlebarsHelpers.numberInput,
  localize: HandlebarsHelpers.localize,
  radioBoxes: HandlebarsHelpers.radioBoxes,
  rangePicker: HandlebarsHelpers.rangePicker,
  select: HandlebarsHelpers.select,
  selectOptions: HandlebarsHelpers.selectOptions,
  timeSince: foundry.utils.timeSince,
  eq: (v1, v2) => v1 === v2,
  ne: (v1, v2) => v1 !== v2,
  lt: (v1, v2) => v1 < v2,
  gt: (v1, v2) => v1 > v2,
  lte: (v1, v2) => v1 <= v2,
  gte: (v1, v2) => v1 >= v2,
  not: pred => !pred,
  and() {return Array.prototype.every.call(arguments, Boolean);},
  or() {return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);}
});
