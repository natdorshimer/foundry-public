/**
 * This module contains data field classes which are used to define a data schema.
 * A data field is responsible for cleaning, validation, and initialization of the value assigned to it.
 * Each data field extends the [DataField]{@link DataField} class to implement logic specific to its
 * contained data type.
 * @module fields
 */

import {
  ALL_DOCUMENT_TYPES,
  BASE_DOCUMENT_TYPE,
  DOCUMENT_OWNERSHIP_LEVELS,
  FILE_CATEGORIES
} from "../constants.mjs";
import DataModel from "../abstract/data.mjs";
import {
  isColorString,
  isValidId,
  isJSON,
  hasFileExtension,
  isBase64Data
} from "./validators.mjs";
import {deepClone, getType, isEmpty, isSubclass, mergeObject, parseUuid} from "../utils/helpers.mjs";
import {logCompatibilityWarning} from "../utils/logging.mjs";
import {DataModelValidationFailure} from "./validation-failure.mjs";
import SingletonEmbeddedCollection from "../abstract/singleton-collection.mjs";
import EmbeddedCollection from "../abstract/embedded-collection.mjs";
import EmbeddedCollectionDelta from "../abstract/embedded-collection-delta.mjs";
import {AsyncFunction} from "../utils/module.mjs";

/* ---------------------------------------- */
/*  Abstract Data Field                     */
/* ---------------------------------------- */

/**
 * @callback DataFieldValidator
 * A Custom DataField validator function.
 *
 * A boolean return value indicates that the value is valid (true) or invalid (false) with certainty. With an explicit
 * boolean return value no further validation functions will be evaluated.
 *
 * An undefined return indicates that the value may be valid but further validation functions should be performed,
 * if defined.
 *
 * An Error may be thrown which provides a custom error message explaining the reason the value is invalid.
 *
 * @param {any} value                     The value provided for validation
 * @param {DataFieldValidationOptions} options  Validation options
 * @returns {boolean|void}
 * @throws {Error}
 */

/**
 * @typedef {Object} DataFieldOptions
 * @property {boolean} [required=false]   Is this field required to be populated?
 * @property {boolean} [nullable=false]   Can this field have null values?
 * @property {boolean} [gmOnly=false]     Can this field only be modified by a gamemaster or assistant gamemaster?
 * @property {Function|*} [initial]       The initial value of a field, or a function which assigns that initial value.
 * @property {string} [label]             A localizable label displayed on forms which render this field.
 * @property {string} [hint]              Localizable help text displayed on forms which render this field.
 * @property {DataFieldValidator} [validate] A custom data field validation function.
 * @property {string} [validationError]   A custom validation error string. When displayed will be prepended with the
 *                                        document name, field name, and candidate value. This error string is only
 *                                        used when the return type of the validate function is a boolean. If an Error
 *                                        is thrown in the validate function, the string message of that Error is used.
 */

/**
 * @typedef {Object} DataFieldContext
 * @property {string} [name]               A field name to assign to the constructed field
 * @property {DataField} [parent]          Another data field which is a hierarchical parent of this one
 */

/**
 * @typedef {object} DataFieldValidationOptions
 * @property {boolean} [partial]   Whether this is a partial schema validation, or a complete one.
 * @property {boolean} [fallback]  Whether to allow replacing invalid values with valid fallbacks.
 * @property {object} [source]     The full source object being evaluated.
 * @property {boolean} [dropInvalidEmbedded]  If true, invalid embedded documents will emit a warning and be placed in
 *                                            the invalidDocuments collection rather than causing the parent to be
 *                                            considered invalid.
 */

/**
 * An abstract class that defines the base pattern for a data field within a data schema.
 * @abstract
 * @property {string} name                The name of this data field within the schema that contains it.
 * @mixes DataFieldOptions
 */
class DataField {
  /**
   * @param {DataFieldOptions} [options]    Options which configure the behavior of the field
   * @param {DataFieldContext} [context]    Additional context which describes the field
   */
  constructor(options={}, {name, parent}={}) {
    this.name = name;
    this.parent = parent;
    this.options = options;
    for ( let k in this.constructor._defaults ) {
      this[k] = k in this.options ? this.options[k] : this.constructor._defaults[k];
    }
  }

  /**
   * The field name of this DataField instance.
   * This is assigned by SchemaField#initialize.
   * @internal
   */
  name;

  /**
   * A reference to the parent schema to which this DataField belongs.
   * This is assigned by SchemaField#initialize.
   * @internal
   */
  parent;

  /**
   * The initially provided options which configure the data field
   * @type {DataFieldOptions}
   */
  options;

  /**
   * Whether this field defines part of a Document/Embedded Document hierarchy.
   * @type {boolean}
   */
  static hierarchical = false;

  /**
   * Does this field type contain other fields in a recursive structure?
   * Examples of recursive fields are SchemaField, ArrayField, or TypeDataField
   * Examples of non-recursive fields are StringField, NumberField, or ObjectField
   * @type {boolean}
   */
  static recursive = false;

  /**
   * Default parameters for this field type
   * @return {DataFieldOptions}
   * @protected
   */
  static get _defaults() {
    return {
      required: false,
      nullable: false,
      initial: undefined,
      readonly: false,
      gmOnly: false,
      label: "",
      hint: "",
      validationError: "is not a valid value"
    }
  }

  /**
   * A dot-separated string representation of the field path within the parent schema.
   * @type {string}
   */
  get fieldPath() {
    return [this.parent?.fieldPath, this.name].filterJoin(".");
  }

  /**
   * Apply a function to this DataField which propagates through recursively to any contained data schema.
   * @param {string|function} fn          The function to apply
   * @param {*} value                     The current value of this field
   * @param {object} [options={}]         Additional options passed to the applied function
   * @returns {object}                    The results object
   */
  apply(fn, value, options={}) {
    if ( typeof fn === "string" ) fn = this[fn];
    return fn.call(this, value, options);
  }

  /* -------------------------------------------- */
  /*  Field Cleaning                              */
  /* -------------------------------------------- */

  /**
   * Coerce source data to ensure that it conforms to the correct data type for the field.
   * Data coercion operations should be simple and synchronous as these are applied whenever a DataModel is constructed.
   * For one-off cleaning of user-provided input the sanitize method should be used.
   * @param {*} value           The initial value
   * @param {object} [options]  Additional options for how the field is cleaned
   * @param {boolean} [options.partial]   Whether to perform partial cleaning?
   * @param {object} [options.source]     The root data model being cleaned
   * @returns {*}               The cast value
   */
  clean(value, options={}) {

    // Permit explicitly null values for nullable fields
    if ( value === null ) {
      if ( this.nullable ) return value;
      value = undefined;
    }

    // Get an initial value for the field
    if ( value === undefined ) return this.getInitialValue(options.source);

    // Cast a provided value to the correct type
    value = this._cast(value);

    // Cleaning logic specific to the DataField.
    return this._cleanType(value, options);
  }

  /* -------------------------------------------- */

  /**
   * Apply any cleaning logic specific to this DataField type.
   * @param {*} value           The appropriately coerced value.
   * @param {object} [options]  Additional options for how the field is cleaned.
   * @returns {*}               The cleaned value.
   * @protected
   */
  _cleanType(value, options) {
    return value;
  }

  /* -------------------------------------------- */

  /**
   * Cast a non-default value to ensure it is the correct type for the field
   * @param {*} value       The provided non-default value
   * @returns {*}           The standardized value
   * @protected
   */
  _cast(value) {
    throw new Error(`Subclasses of DataField must implement the _cast method`);
  }

  /* -------------------------------------------- */

  /**
   * Attempt to retrieve a valid initial value for the DataField.
   * @param {object} data   The source data object for which an initial value is required
   * @returns {*}           A valid initial value
   * @throws                An error if there is no valid initial value defined
   */
  getInitialValue(data) {
    return this.initial instanceof Function ? this.initial(data) : this.initial;
  }

  /* -------------------------------------------- */
  /*  Field Validation                            */
  /* -------------------------------------------- */

  /**
   * Validate a candidate input for this field, ensuring it meets the field requirements.
   * A validation failure can be provided as a raised Error (with a string message), by returning false, or by returning
   * a DataModelValidationFailure instance.
   * A validator which returns true denotes that the result is certainly valid and further validations are unnecessary.
   * @param {*} value                                  The initial value
   * @param {DataFieldValidationOptions} [options={}]  Options which affect validation behavior
   * @returns {DataModelValidationFailure}             Returns a DataModelValidationFailure if a validation failure
   *                                                   occurred.
   */
  validate(value, options={}) {
    const validators = [this._validateSpecial, this._validateType];
    if ( this.options.validate ) validators.push(this.options.validate);
    try {
      for ( const validator of validators ) {
        const isValid = validator.call(this, value, options);
        if ( isValid === true ) return undefined;
        if ( isValid === false ) {
          return new DataModelValidationFailure({
            invalidValue: value,
            message: this.validationError,
            unresolved: true
          });
        }
        if ( isValid instanceof DataModelValidationFailure ) return isValid;
      }
    } catch(err) {
      return new DataModelValidationFailure({invalidValue: value, message: err.message, unresolved: true});
    }
  }

  /* -------------------------------------------- */

  /**
   * Special validation rules which supersede regular field validation.
   * This validator screens for certain values which are otherwise incompatible with this field like null or undefined.
   * @param {*} value               The candidate value
   * @returns {boolean|void}        A boolean to indicate with certainty whether the value is valid.
   *                                Otherwise, return void.
   * @throws                        May throw a specific error if the value is not valid
   * @protected
   */
  _validateSpecial(value) {

    // Allow null values for explicitly nullable fields
    if ( value === null ) {
      if ( this.nullable ) return true;
      else throw new Error("may not be null");
    }

    // Allow undefined if the field is not required
    if ( value === undefined ) {
      if ( this.required ) throw new Error("may not be undefined");
      else return true;
    }
  }

  /* -------------------------------------------- */

  /**
   * A default type-specific validator that can be overridden by child classes
   * @param {*} value                                    The candidate value
   * @param {DataFieldValidationOptions} [options={}]    Options which affect validation behavior
   * @returns {boolean|DataModelValidationFailure|void}  A boolean to indicate with certainty whether the value is
   *                                                     valid, or specific DataModelValidationFailure information,
   *                                                     otherwise void.
   * @throws                                             May throw a specific error if the value is not valid
   * @protected
   */
  _validateType(value, options={}) {}

  /* -------------------------------------------- */

  /**
   * Certain fields may declare joint data validation criteria.
   * This method will only be called if the field is designated as recursive.
   * @param {object} data       Candidate data for joint model validation
   * @param {object} options    Options which modify joint model validation
   * @throws  An error if joint model validation fails
   * @internal
   */
  _validateModel(data, options={}) {}

  /* -------------------------------------------- */
  /*  Initialization and Serialization            */
  /* -------------------------------------------- */

  /**
   * Initialize the original source data into a mutable copy for the DataModel instance.
   * @param {*} value                   The source value of the field
   * @param {Object} model              The DataModel instance that this field belongs to
   * @param {object} [options]          Initialization options
   * @returns {*}                       An initialized copy of the source data
   */
  initialize(value, model, options={}) {
    return value;
  }

  /**
   * Export the current value of the field into a serializable object.
   * @param {*} value                   The initialized value of the field
   * @returns {*}                       An exported representation of the field
   */
  toObject(value) {
    return value;
  }

  /**
   * Recursively traverse a schema and retrieve a field specification by a given path
   * @param {string[]} path             The field path as an array of strings
   * @internal
   */
  _getField(path) {
    return path.length ? undefined : this;
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /**
   * Does this form field class have defined form support?
   * @type {boolean}
   */
  static get hasFormSupport() {
    return this.prototype._toInput !== DataField.prototype._toInput;
  }

  /* -------------------------------------------- */

  /**
   * Render this DataField as an HTML element.
   * @param {FormInputConfig} config        Form element configuration parameters
   * @throws {Error}                        An Error if this DataField subclass does not support input rendering
   * @returns {HTMLElement|HTMLCollection}  A rendered HTMLElement for the field
   */
  toInput(config={}) {
    const inputConfig = {name: this.fieldPath, ...config};
    if ( inputConfig.input instanceof Function ) return config.input(this, inputConfig);
    return this._toInput(inputConfig);
  }

  /* -------------------------------------------- */

  /**
   * Render this DataField as an HTML element.
   * Subclasses should implement this method rather than the public toInput method which wraps it.
   * @param {FormInputConfig} config        Form element configuration parameters
   * @throws {Error}                        An Error if this DataField subclass does not support input rendering
   * @returns {HTMLElement|HTMLCollection}  A rendered HTMLElement for the field
   * @protected
   */
  _toInput(config) {
    throw new Error(`The ${this.constructor.name} class does not implement the _toInput method`);
  }

  /* -------------------------------------------- */

  /**
   * Render this DataField as a standardized form-group element.
   * @param {FormGroupConfig} groupConfig   Configuration options passed to the wrapping form-group
   * @param {FormInputConfig} inputConfig   Input element configuration options passed to DataField#toInput
   * @returns {HTMLDivElement}              The rendered form group element
   */
  toFormGroup(groupConfig={}, inputConfig={}) {
    if ( groupConfig.widget instanceof Function ) return groupConfig.widget(this, groupConfig, inputConfig);
    groupConfig.label ??= this.label ?? this.fieldPath;
    groupConfig.hint ??= this.hint;
    groupConfig.input ??= this.toInput(inputConfig);
    return foundry.applications.fields.createFormGroup(groupConfig);
  }

  /* -------------------------------------------- */
  /*  Active Effect Integration                   */
  /* -------------------------------------------- */

  /**
   * Apply an ActiveEffectChange to this field.
   * @param {*} value                  The field's current value.
   * @param {DataModel} model          The model instance.
   * @param {EffectChangeData} change  The change to apply.
   * @returns {*}                      The updated value.
   */
  applyChange(value, model, change) {
    const delta = this._castChangeDelta(change.value);
    switch ( change.mode ) {
      case CONST.ACTIVE_EFFECT_MODES.ADD: return this._applyChangeAdd(value, delta, model, change);
      case CONST.ACTIVE_EFFECT_MODES.MULTIPLY: return this._applyChangeMultiply(value, delta, model, change);
      case CONST.ACTIVE_EFFECT_MODES.OVERRIDE: return this._applyChangeOverride(value, delta, model, change);
      case CONST.ACTIVE_EFFECT_MODES.UPGRADE: return this._applyChangeUpgrade(value, delta, model, change);
      case CONST.ACTIVE_EFFECT_MODES.DOWNGRADE: return this._applyChangeDowngrade(value, delta, model, change);
    }
    return this._applyChangeCustom(value, delta, model, change);
  }

  /* -------------------------------------------- */

  /**
   * Cast a change delta into an appropriate type to be applied to this field.
   * @param {*} delta  The change delta.
   * @returns {*}
   * @internal
   */
  _castChangeDelta(delta) {
    return this._cast(delta);
  }

  /* -------------------------------------------- */

  /**
   * Apply an ADD change to this field.
   * @param {*} value                  The field's current value.
   * @param {*} delta                  The change delta.
   * @param {DataModel} model          The model instance.
   * @param {EffectChangeData} change  The original change data.
   * @returns {*}                      The updated value.
   * @protected
   */
  _applyChangeAdd(value, delta, model, change) {
    return value + delta;
  }

  /* -------------------------------------------- */

  /**
   * Apply a MULTIPLY change to this field.
   * @param {*} value                  The field's current value.
   * @param {*} delta                  The change delta.
   * @param {DataModel} model          The model instance.
   * @param {EffectChangeData} change  The original change data.
   * @returns {*}                      The updated value.
   * @protected
   */
  _applyChangeMultiply(value, delta, model, change) {}

  /* -------------------------------------------- */

  /**
   * Apply an OVERRIDE change to this field.
   * @param {*} value                  The field's current value.
   * @param {*} delta                  The change delta.
   * @param {DataModel} model          The model instance.
   * @param {EffectChangeData} change  The original change data.
   * @returns {*}                      The updated value.
   * @protected
   */
  _applyChangeOverride(value, delta, model, change) {
    return delta;
  }

  /* -------------------------------------------- */

  /**
   * Apply an UPGRADE change to this field.
   * @param {*} value                  The field's current value.
   * @param {*} delta                  The change delta.
   * @param {DataModel} model          The model instance.
   * @param {EffectChangeData} change  The original change data.
   * @returns {*}                      The updated value.
   * @protected
   */
  _applyChangeUpgrade(value, delta, model, change) {}

  /* -------------------------------------------- */

  /**
   * Apply a DOWNGRADE change to this field.
   * @param {*} value                  The field's current value.
   * @param {*} delta                  The change delta.
   * @param {DataModel} model          The model instance.
   * @param {EffectChangeData} change  The original change data.
   * @returns {*}                      The updated value.
   * @protected
   */
  _applyChangeDowngrade(value, delta, model, change) {}

  /* -------------------------------------------- */

  /**
   * Apply a CUSTOM change to this field.
   * @param {*} value                  The field's current value.
   * @param {*} delta                  The change delta.
   * @param {DataModel} model          The model instance.
   * @param {EffectChangeData} change  The original change data.
   * @returns {*}                      The updated value.
   * @protected
   */
  _applyChangeCustom(value, delta, model, change) {
    const preHook = foundry.utils.getProperty(model, change.key);
    Hooks.call("applyActiveEffect", model, change, value, delta, {});
    const postHook = foundry.utils.getProperty(model, change.key);
    if ( postHook !== preHook ) return postHook;
  }
}

/* -------------------------------------------- */
/*  Data Schema Field                           */
/* -------------------------------------------- */

/**
 * A special class of {@link DataField} which defines a data schema.
 */
class SchemaField extends DataField {
  /**
   * @param {DataSchema} fields                 The contained field definitions
   * @param {DataFieldOptions} [options]        Options which configure the behavior of the field
   * @param {DataFieldContext} [context]        Additional context which describes the field
   */
  constructor(fields, options, context={}) {
    super(options, context);
    this.fields = this._initialize(fields);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      nullable: false,
      initial() { return this.clean({}); }
    });
  }

  /** @override */
  static recursive = true;

  /* -------------------------------------------- */

  /**
   * The contained field definitions.
   * @type {DataSchema}
   */
  fields;

  /**
   * Any unknown keys encountered during the last cleaning.
   * @type {string[]}
   */
  unknownKeys;

  /* -------------------------------------------- */

  /**
   * Initialize and validate the structure of the provided field definitions.
   * @param {DataSchema} fields     The provided field definitions
   * @returns {DataSchema}          The validated schema
   * @protected
   */
  _initialize(fields) {
    if ( (typeof fields !== "object") ) {
      throw new Error("A DataSchema must be an object with string keys and DataField values.");
    }
    fields = {...fields};
    for ( const [name, field] of Object.entries(fields) ) {
      if ( !(field instanceof DataField) ) {
        throw new Error(`The "${name}" field is not an instance of the DataField class.`);
      }
      if ( field.parent !== undefined ) {
        throw new Error(`The "${field.fieldPath}" field already belongs to some other parent and may not be reused.`);
      }
      field.name = name;
      field.parent = this;
    }
    return fields;
  }

  /* -------------------------------------------- */
  /*  Schema Iteration                            */
  /* -------------------------------------------- */

  /**
   * Iterate over a SchemaField by iterating over its fields.
   * @type {Iterable<DataField>}
   */
  *[Symbol.iterator]() {
    for ( const field of Object.values(this.fields) ) {
      yield field;
    }
  }

  /**
   * An array of field names which are present in the schema.
   * @returns {string[]}
   */
  keys() {
    return Object.keys(this.fields);
  }

  /**
   * An array of DataField instances which are present in the schema.
   * @returns {DataField[]}
   */
  values() {
    return Object.values(this.fields);
  }

  /**
   * An array of [name, DataField] tuples which define the schema.
   * @returns {Array<[string, DataField]>}
   */
  entries() {
    return Object.entries(this.fields);
  }

  /**
   * Test whether a certain field name belongs to this schema definition.
   * @param {string} fieldName    The field name
   * @returns {boolean}           Does the named field exist in this schema?
   */
  has(fieldName) {
    return fieldName in this.fields;
  }

  /**
   * Get a DataField instance from the schema by name
   * @param {string} fieldName    The field name
   * @returns {DataField}         The DataField instance or undefined
   */
  get(fieldName) {
    return this.fields[fieldName];
  }

  /**
   * Traverse the schema, obtaining the DataField definition for a particular field.
   * @param {string[]|string} fieldName       A field path like ["abilities", "strength"] or "abilities.strength"
   * @returns {SchemaField|DataField}         The corresponding DataField definition for that field, or undefined
   */
  getField(fieldName) {
    let path;
    if ( typeof fieldName === "string" ) path = fieldName.split(".");
    else if ( Array.isArray(fieldName) ) path = fieldName.slice();
    else throw new Error("A field path must be an array of strings or a dot-delimited string");
    return this._getField(path);
  }

  /** @override */
  _getField(path) {
    if ( !path.length ) return this;
    const field = this.get(path.shift());
    return field?._getField(path);
  }

  /* -------------------------------------------- */
  /*  Data Field Methods                          */
  /* -------------------------------------------- */

  /** @override */
  _cast(value) {
    return typeof value === "object" ? value : {};
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _cleanType(data, options={}) {
    options.source = options.source || data;

    // Clean each field which belongs to the schema
    for ( const [name, field] of this.entries() ) {
      if ( !(name in data) && options.partial ) continue;
      data[name] = field.clean(data[name], options);
    }

    // Delete any keys which do not
    this.unknownKeys = [];
    for ( const k of Object.keys(data) ) {
      if ( this.has(k) ) continue;
      this.unknownKeys.push(k);
      delete data[k];
    }
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  initialize(value, model, options={}) {
    if ( !value ) return value;
    const data = {};
    for ( let [name, field] of this.entries() ) {
      const v = field.initialize(value[name], model, options);

      // Readonly fields
      if ( field.readonly ) {
        Object.defineProperty(data, name, {value: v, writable: false});
      }

      // Getter fields
      else if ( (typeof v === "function") && !v.prototype ) {
        Object.defineProperty(data, name, {get: v, set() {}, configurable: true});
      }

      // Writable fields
      else data[name] = v;
    }
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  _validateType(data, options={}) {
    if ( !(data instanceof Object) ) throw new Error("must be an object");
    options.source = options.source || data;
    const schemaFailure = new DataModelValidationFailure();
    for ( const [key, field] of this.entries() ) {
      if ( options.partial && !(key in data) ) continue;

      // Validate the field's current value
      const value = data[key];
      const failure = field.validate(value, options);

      // Failure may be permitted if fallback replacement is allowed
      if ( failure ) {
        schemaFailure.fields[field.name] = failure;

        // If the field internally applied fallback logic
        if ( !failure.unresolved ) continue;

        // If fallback is allowed at the schema level
        if ( options.fallback ) {
          const initial = field.getInitialValue(options.source);
          if ( field.validate(initial, {source: options.source}) === undefined ) {  // Ensure initial is valid
            data[key] = initial;
            failure.fallback = initial;
            failure.unresolved = false;
          }
          else failure.unresolved = schemaFailure.unresolved = true;
        }

        // Otherwise the field-level failure is unresolved
        else failure.unresolved = schemaFailure.unresolved = true;
      }
    }
    if ( !isEmpty(schemaFailure.fields) ) return schemaFailure;
  }

  /* ---------------------------------------- */

  /** @override */
  _validateModel(changes, options={}) {
    options.source = options.source || changes;
    if ( !changes ) return;
    for ( const [name, field] of this.entries() ) {
      const change = changes[name];  // May be nullish
      if ( change && field.constructor.recursive ) field._validateModel(change, options);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  toObject(value) {
    if ( (value === undefined) || (value === null) ) return value;
    const data = {};
    for ( const [name, field] of this.entries() ) {
      data[name] = field.toObject(value[name]);
    }
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  apply(fn, data={}, options={}) {

    // Apply to this SchemaField
    const thisFn = typeof fn === "string" ? this[fn] : fn;
    thisFn?.call(this, data, options);

    // Recursively apply to inner fields
    const results = {};
    for ( const [key, field] of this.entries() ) {
      if ( options.partial && !(key in data) ) continue;
      const r = field.apply(fn, data[key], options);
      if ( !options.filter || !isEmpty(r) ) results[key] = r;
    }
    return results;
  }

  /* -------------------------------------------- */

  /**
   * Migrate this field's candidate source data.
   * @param {object} sourceData   Candidate source data of the root model
   * @param {any} fieldData       The value of this field within the source data
   */
  migrateSource(sourceData, fieldData) {
    for ( const [key, field] of this.entries() ) {
      const canMigrate = field.migrateSource instanceof Function;
      if ( canMigrate && fieldData[key] ) field.migrateSource(sourceData, fieldData[key]);
    }
  }
}

/* -------------------------------------------- */
/*  Basic Field Types                           */
/* -------------------------------------------- */

/**
 * A subclass of [DataField]{@link DataField} which deals with boolean-typed data.
 */
class BooleanField extends DataField {

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      nullable: false,
      initial: false
    });
  }

  /** @override */
  _cast(value) {
    if ( typeof value === "string" ) return value === "true";
    if ( typeof value === "object" ) return false;
    return Boolean(value);
  }

  /** @override */
  _validateType(value) {
    if (typeof value !== "boolean") throw new Error("must be a boolean");
  }

  /** @override */
  _toInput(config) {
    return foundry.applications.fields.createCheckboxInput(config);
  }

  /* -------------------------------------------- */
  /*  Active Effect Integration                   */
  /* -------------------------------------------- */

  /** @override */
  _applyChangeAdd(value, delta, model, change) {
    return value || delta;
  }

  /** @override */
  _applyChangeMultiply(value, delta, model, change) {
    return value && delta;
  }

  /** @override */
  _applyChangeUpgrade(value, delta, model, change) {
    return delta > value ? delta : value;
  }

  _applyChangeDowngrade(value, delta, model, change) {
    return delta < value ? delta : value;
  }
}

/* ---------------------------------------- */

/**
 * @typedef {DataFieldOptions} NumberFieldOptions
 * @property {number} [min]               A minimum allowed value
 * @property {number} [max]               A maximum allowed value
 * @property {number} [step]              A permitted step size
 * @property {boolean} [integer=false]    Must the number be an integer?
 * @property {number} [positive=false]    Must the number be positive?
 * @property {number[]|object|function} [choices]  An array of values or an object of values/labels which represent
 *                                        allowed choices for the field. A function may be provided which dynamically
 *                                        returns the array of choices.
 */

/**
 * A subclass of [DataField]{@link DataField} which deals with number-typed data.
 *
 * @property {number} min                 A minimum allowed value
 * @property {number} max                 A maximum allowed value
 * @property {number} step                A permitted step size
 * @property {boolean} integer=false      Must the number be an integer?
 * @property {number} positive=false      Must the number be positive?
 * @property {number[]|object|function} [choices]  An array of values or an object of values/labels which represent
 *                                        allowed choices for the field. A function may be provided which dynamically
 *                                        returns the array of choices.
 */
class NumberField extends DataField {
  /**
   * @param {NumberFieldOptions} options  Options which configure the behavior of the field
   * @param {DataFieldContext} [context]  Additional context which describes the field
   */
  constructor(options={}, context={}) {
    super(options, context);
    // If choices are provided, the field should not be null by default
    if ( this.choices ) {
      this.nullable = options.nullable ?? false;
    }
    if ( Number.isFinite(this.min) && Number.isFinite(this.max) && (this.min > this.max) ) {
      throw new Error("NumberField minimum constraint cannot exceed its maximum constraint");
    }
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      initial: null,
      nullable: true,
      min: undefined,
      max: undefined,
      step: undefined,
      integer: false,
      positive: false,
      choices: undefined
    });
  }

  /** @override */
  _cast(value) {
    return Number(value);
  }

  /** @inheritdoc */
  _cleanType(value, options) {
    value = super._cleanType(value, options);
    if ( typeof value !== "number" ) return value;
    if ( this.integer ) value = Math.round(value);
    if ( Number.isFinite(this.min) ) value = Math.max(value, this.min);
    if ( Number.isFinite(this.max) ) value = Math.min(value, this.max);
    if ( Number.isFinite(this.step) ) value = value.toNearest(this.step);
    return value;
  }

  /** @override */
  _validateType(value) {
    if ( typeof value !== "number" ) throw new Error("must be a number");
    if ( this.positive && (value <= 0) ) throw new Error("must be a positive number");
    if ( Number.isFinite(this.min) && (value < this.min) ) throw new Error(`must be at least ${this.min}`);
    if ( Number.isFinite(this.max) && (value > this.max) ) throw new Error(`must be at most ${this.max}`);
    if ( Number.isFinite(this.step) && (value.toNearest(this.step) !== value) ) {
      throw new Error(`must be an increment of ${this.step}`);
    }
    if ( this.choices && !this.#isValidChoice(value) ) throw new Error(`${value} is not a valid choice`);
    if ( this.integer ) {
      if ( !Number.isInteger(value) ) throw new Error("must be an integer");
    }
    else if ( !Number.isFinite(value) ) throw new Error("must be a finite number");
  }

  /**
   * Test whether a provided value is a valid choice from the allowed choice set
   * @param {number} value      The provided value
   * @returns {boolean}         Is the choice valid?
   */
  #isValidChoice(value) {
    let choices = this.choices;
    if ( choices instanceof Function ) choices = choices();
    if ( choices instanceof Array ) return choices.includes(value);
    return String(value) in choices;
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /** @override */
  _toInput(config) {
    config.min ??= this.min;
    config.max ??= this.max;
    config.step ??= this.step;
    if ( config.value === undefined ) config.value = this.getInitialValue({});
    if ( this.integer ) {
      if ( Number.isNumeric(config.value) ) config.value = Math.round(config.value);
      config.step ??= 1;
    }
    if ( this.positive && Number.isFinite(config.step) ) config.min ??= config.step;

    // Number Select
    config.choices ??= this.choices;
    if ( config.choices && !config.options ) {
      config.options = StringField._getChoices(config);
      delete config.valueAttr;
      delete config.labelAttr;
      config.dataset ||= {};
      config.dataset.dtype = "Number";
    }
    if ( config.options ) return foundry.applications.fields.createSelectInput(config);

    // Range Slider
    if ( ["min", "max", "step"].every(k => config[k] !== undefined) && (config.type !== "number") ) {
      return foundry.applications.elements.HTMLRangePickerElement.create(config);
    }

    // Number Input
    return foundry.applications.fields.createNumberInput(config);
  }

  /* -------------------------------------------- */
  /*  Active Effect Integration                   */
  /* -------------------------------------------- */

  /** @override */
  _applyChangeMultiply(value, delta, model, change) {
    return value * delta;
  }

  /** @override */
  _applyChangeUpgrade(value, delta, model, change) {
    return delta > value ? delta : value;
  }

  /** @override */
  _applyChangeDowngrade(value, delta, model, change) {
    return delta < value ? delta : value;
  }
}

/* ---------------------------------------- */

/**
 * @typedef {Object} StringFieldParams
 * @property {boolean} [blank=true]       Is the string allowed to be blank (empty)?
 * @property {boolean} [trim=true]        Should any provided string be trimmed as part of cleaning?
 * @property {string[]|object|function} [choices]  An array of values or an object of values/labels which represent
 *                                        allowed choices for the field. A function may be provided which dynamically
 *                                        returns the array of choices.
 * @property {boolean} [textSearch=false] Is this string field a target for text search?
 * @typedef {DataFieldOptions&StringFieldParams} StringFieldOptions
 */

/**
 * A subclass of {@link DataField} which deals with string-typed data.
 */
class StringField extends DataField {
  /**
   * @param {StringFieldOptions} [options]  Options which configure the behavior of the field
   * @param {DataFieldContext} [context]    Additional context which describes the field
   */
  constructor(options={}, context={}) {
    super(options, context);

    // If choices are provided, the field should not be null or blank by default
    if ( this.choices ) {
      this.nullable = options.nullable ?? false;
      this.blank = options.blank ?? false;
    }
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      blank: true,
      trim: true,
      nullable: false,
      initial() {
        // The initial value depends on the field configuration
        if ( !this.required ) return undefined;
        else if ( this.blank ) return "";
        else if ( this.nullable ) return null;
        return undefined;
      },
      choices: undefined,
      textSearch: false
    });
  }

  /**
   * Is the string allowed to be blank (empty)?
   * @type {boolean}
   */
  blank = this.blank;

  /**
   * Should any provided string be trimmed as part of cleaning?
   * @type {boolean}
   */
  trim = this.trim;

  /**
   * An array of values or an object of values/labels which represent
   * allowed choices for the field. A function may be provided which dynamically
   * returns the array of choices.
   * @type {string[]|object|function}
   */
  choices = this.choices;

  /**
   * Is this string field a target for text search?
   * @type {boolean}
   */
  textSearch = this.textSearch;

  /** @inheritdoc */
  clean(value, options) {
    if ( (typeof value === "string") && this.trim ) value = value.trim(); // Trim input strings
    if ( value === "" ) {  // Permit empty strings for blank fields
      if ( this.blank ) return value;
      value = undefined;
    }
    return super.clean(value, options);
  }

  /** @override */
  _cast(value) {
    return String(value);
  }

  /** @inheritdoc */
  _validateSpecial(value) {
    if ( value === "" ) {
      if ( this.blank ) return true;
      else throw new Error("may not be a blank string");
    }
    return super._validateSpecial(value);
  }

  /** @override */
  _validateType(value) {
    if ( typeof value !== "string" ) throw new Error("must be a string");
    else if ( this.choices ) {
      if ( this._isValidChoice(value) ) return true;
      else throw new Error(`${value} is not a valid choice`);
    }
  }

  /**
   * Test whether a provided value is a valid choice from the allowed choice set
   * @param {string} value      The provided value
   * @returns {boolean}         Is the choice valid?
   * @protected
   */
  _isValidChoice(value) {
    let choices = this.choices;
    if ( choices instanceof Function ) choices = choices();
    if ( choices instanceof Array ) return choices.includes(value);
    return String(value) in choices;
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /**
   * Get a record of eligible choices for the field.
   * @param {object} [options]
   * @param {Record<any, any>|Array<any>} options.choices
   * @param {string} [options.labelAttr="label"]   The property in the choice object values to use as the option label.
   * @param {string} [options.valueAttr]
   * @param {boolean} [options.localize=false]     Pass each label through string localization?
   * @returns {FormSelectOption[]}
   * @internal
   */
  static _getChoices({choices, labelAttr="label", valueAttr, localize=false}={}) {
    if ( choices instanceof Function ) choices = choices();
    if ( typeof choices === "object" ) {
      choices = Object.entries(choices).reduce((arr, [value, label]) => {
        if ( typeof label !== "string" ) {
          if ( valueAttr && (valueAttr in label) ) value = label[valueAttr];
          label = label[labelAttr] ?? "undefined";
        }
        if ( localize ) label = game.i18n.localize(label);
        arr.push({value, label});
        return arr;
      }, [])
    }
    return choices;
  }

  /* -------------------------------------------- */

  /** @override */
  _toInput(config) {
    if ( config.value === undefined ) config.value = this.getInitialValue({});
    config.choices ??= this.choices;
    if ( config.choices && !config.options ) {
      config.options = StringField._getChoices(config);
      delete config.choices;
      delete config.valueAttr;
      delete config.labelAttr;
      if ( this.blank || !this.required ) config.blank ??= "";
    }
    if ( config.options ) return foundry.applications.fields.createSelectInput(config);
    return foundry.applications.fields.createTextInput(config);
  }
}

/* ---------------------------------------- */

/**
 * A subclass of [DataField]{@link DataField} which deals with object-typed data.
 */
class ObjectField extends DataField {

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      nullable: false
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getInitialValue(data) {
    const initial = super.getInitialValue(data);
    if ( initial ) return initial;          // Explicit initial value defined by subclass
    if ( !this.required ) return undefined; // The ObjectField may be undefined
    if ( this.nullable ) return null;       // The ObjectField may be null
    return {};                              // Otherwise an empty object
  }

  /** @override */
  _cast(value) {
    return getType(value) === "Object" ? value : {};
  }

  /** @override */
  initialize(value, model, options={}) {
    if ( !value ) return value;
    return deepClone(value);
  }

  /** @override */
  toObject(value) {
    return deepClone(value);
  }

  /** @override */
  _validateType(value, options={}) {
    if ( getType(value) !== "Object" ) throw new Error("must be an object");
  }
}

/* -------------------------------------------- */

/**
 * @typedef {DataFieldOptions} ArrayFieldOptions
 * @property {number} [min]          The minimum number of elements.
 * @property {number} [max]          The maximum number of elements.
 */

/**
 * A subclass of [DataField]{@link DataField} which deals with array-typed data.
 * @property {number} min     The minimum number of elements.
 * @property {number} max     The maximum number of elements.
 */
class ArrayField extends DataField {
  /**
   * @param {DataField} element            A DataField instance which defines the type of element contained in the Array
   * @param {ArrayFieldOptions} [options]  Options which configure the behavior of the field
   * @param {DataFieldContext} [context]   Additional context which describes the field
   */
  constructor(element, options={}, context={}) {
    super(options, context);
    /**
     * The data type of each element in this array
     * @type {DataField}
     */
    this.element = this.constructor._validateElementType(element);
    if ( this.min > this.max ) throw new Error("ArrayField minimum length cannot exceed maximum length");
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      nullable: false,
      empty: true,
      exact: undefined,
      min: 0,
      max: Infinity,
      initial: () => []
    });
  }

  /** @override */
  static recursive = true;

  /* ---------------------------------------- */

  /**
   * Validate the contained element type of the ArrayField
   * @param {*} element       The type of Array element
   * @returns {*}             The validated element type
   * @throws                  An error if the element is not a valid type
   * @protected
   */
  static _validateElementType(element) {
    if ( !(element instanceof DataField) ) {
      throw new Error(`${this.name} must have a DataField as its contained element`);
    }
    return element;
  }

  /* ---------------------------------------- */

  /** @override */
  _validateModel(changes, options) {
    if ( !this.element.constructor.recursive ) return;
    for ( const element of changes ) {
      this.element._validateModel(element, options);
    }
  }

  /* ---------------------------------------- */

  /** @override */
  _cast(value) {
    const t = getType(value);
    if ( t === "Object" ) {
      const arr = [];
      for ( const [k, v] of Object.entries(value) ) {
        const i = Number(k);
        if ( Number.isInteger(i) && (i >= 0) ) arr[i] = v;
      }
      return arr;
    }
    else if ( t === "Set" ) return Array.from(value);
    return value instanceof Array ? value : [value];
  }

  /** @override */
  _cleanType(value, options) {
    // Force partial as false for array cleaning. Arrays are updated by replacing the entire array, so partial data
    // must be initialized.
    return value.map(v => this.element.clean(v, { ...options, partial: false }));
  }

  /** @override */
  _validateType(value, options={}) {
    if ( !(value instanceof Array) ) throw new Error("must be an Array");
    if ( value.length < this.min ) throw new Error(`cannot have fewer than ${this.min} elements`);
    if ( value.length > this.max ) throw new Error(`cannot have more than ${this.max} elements`);
    return this._validateElements(value, options);
  }

  /**
   * Validate every element of the ArrayField
   * @param {Array} value                         The array to validate
   * @param {DataFieldValidationOptions} options  Validation options
   * @returns {DataModelValidationFailure|void}   A validation failure if any of the elements failed validation,
   *                                              otherwise void.
   * @protected
   */
  _validateElements(value, options) {
    const arrayFailure = new DataModelValidationFailure();
    for ( let i=0; i<value.length; i++ ) {
      // Force partial as false for array validation. Arrays are updated by replacing the entire array, so there cannot
      // be partial data in the elements.
      const failure = this._validateElement(value[i], { ...options, partial: false });
      if ( failure ) {
        arrayFailure.elements.push({id: i, failure});
        arrayFailure.unresolved ||= failure.unresolved;
      }
    }
    if ( arrayFailure.elements.length ) return arrayFailure;
  }

  /**
   * Validate a single element of the ArrayField.
   * @param {*} value                       The value of the array element
   * @param {DataFieldValidationOptions} options  Validation options
   * @returns {DataModelValidationFailure}  A validation failure if the element failed validation
   * @protected
   */
  _validateElement(value, options) {
    return this.element.validate(value, options);
  }

  /** @override */
  initialize(value, model, options={}) {
    if ( !value ) return value;
    return value.map(v => this.element.initialize(v, model, options));
  }

  /** @override */
  toObject(value) {
    if ( !value ) return value;
    return value.map(v => this.element.toObject(v));
  }

  /** @override */
  apply(fn, value=[], options={}) {

    // Apply to this ArrayField
    const thisFn = typeof fn === "string" ? this[fn] : fn;
    thisFn?.call(this, value, options);

    // Recursively apply to array elements
    const results = [];
    if ( !value.length && options.initializeArrays ) value = [undefined];
    for ( const v of value ) {
      const r = this.element.apply(fn, v, options);
      if ( !options.filter || !isEmpty(r) ) results.push(r);
    }
    return results;
  }

  /** @override */
  _getField(path) {
    if ( !path.length ) return this;
    if ( path[0] === "element" ) path.shift();
    return this.element._getField(path);
  }

  /**
   * Migrate this field's candidate source data.
   * @param {object} sourceData   Candidate source data of the root model
   * @param {any} fieldData       The value of this field within the source data
   */
  migrateSource(sourceData, fieldData) {
    const canMigrate = this.element.migrateSource instanceof Function;
    if ( canMigrate && (fieldData instanceof Array) ) {
      for ( const entry of fieldData ) this.element.migrateSource(sourceData, entry);
    }
  }

  /* -------------------------------------------- */
  /*  Active Effect Integration                   */
  /* -------------------------------------------- */

  /** @override */
  _castChangeDelta(raw) {
    let delta;
    try {
      delta = JSON.parse(raw);
      delta = Array.isArray(delta) ? delta : [delta];
    } catch {
      delta = [raw];
    }
    return delta.map(value => this.element._castChangeDelta(value));
  }

  /** @override */
  _applyChangeAdd(value, delta, model, change) {
    value.push(...delta);
    return value;
  }
}

/* -------------------------------------------- */
/*  Specialized Field Types                     */
/* -------------------------------------------- */

/**
 * A subclass of [ArrayField]{@link ArrayField} which supports a set of contained elements.
 * Elements in this set are treated as fungible and may be represented in any order or discarded if invalid.
 */
class SetField extends ArrayField {

  /** @override */
  _validateElements(value, options) {
    const setFailure = new DataModelValidationFailure();
    for ( let i=value.length-1; i>=0; i-- ) {  // iterate backwards so we can splice as we go
      const failure = this._validateElement(value[i], options);
      if ( failure ) {
        setFailure.elements.unshift({id: i, failure});

        // The failure may have been internally resolved by fallback logic
        if ( !failure.unresolved && failure.fallback ) continue;

        // If fallback is allowed, remove invalid elements from the set
        if ( options.fallback ) {
          value.splice(i, 1);
          failure.dropped = true;
        }

        // Otherwise the set failure is unresolved
        else setFailure.unresolved = true;
      }
    }

    // Return a record of any failed set elements
    if ( setFailure.elements.length ) {
      if ( options.fallback && !setFailure.unresolved ) setFailure.fallback = value;
      return setFailure;
    }
  }

  /** @override */
  initialize(value, model, options={}) {
    if ( !value ) return value;
    return new Set(super.initialize(value, model, options));
  }

  /** @override */
  toObject(value) {
    if ( !value ) return value;
    return Array.from(value).map(v => this.element.toObject(v));
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /** @override */
  _toInput(config) {
    const e = this.element;

    // Document UUIDs
    if ( e instanceof DocumentUUIDField ) {
      Object.assign(config, {type: e.type, single: false});
      return foundry.applications.elements.HTMLDocumentTagsElement.create(config);
    }

    // Multi-Select Input
    if ( e.choices && !config.options ) {
      config.options = StringField._getChoices({choices: e.choices, ...config});
    }
    if ( config.options ) return foundry.applications.fields.createMultiSelectInput(config);

    // Arbitrary String Tags
    if ( e instanceof StringField ) return foundry.applications.elements.HTMLStringTagsElement.create(config);
    throw new Error(`SetField#toInput is not supported for a ${e.constructor.name} element type`);
  }

  /* -------------------------------------------- */
  /*  Active Effect Integration                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _castChangeDelta(raw) {
    return new Set(super._castChangeDelta(raw));
  }

  /** @override */
  _applyChangeAdd(value, delta, model, change) {
    for ( const element of delta ) value.add(element);
    return value;
  }
}

/* ---------------------------------------- */

/**
 * A subclass of [ObjectField]{@link ObjectField} which embeds some other DataModel definition as an inner object.
 */
class EmbeddedDataField extends SchemaField {
  /**
   * @param {typeof DataModel} model          The class of DataModel which should be embedded in this field
   * @param {DataFieldOptions} [options]      Options which configure the behavior of the field
   * @param {DataFieldContext} [context]      Additional context which describes the field
   */
  constructor(model, options={}, context={}) {
    if ( !isSubclass(model, DataModel) ) {
      throw new Error("An EmbeddedDataField must specify a DataModel class as its type");
    }

    // Create an independent copy of the model schema
    const fields = model.defineSchema();
    super(fields, options, context);

    /**
     * The base DataModel definition which is contained in this field.
     * @type {typeof DataModel}
     */
    this.model = model;
  }

  /** @inheritdoc */
  clean(value, options) {
    return super.clean(value, {...options, source: value});
  }

  /** @inheritdoc */
  validate(value, options) {
    return super.validate(value, {...options, source: value});
  }

  /** @override */
  initialize(value, model, options={}) {
    if ( !value ) return value;
    const m = new this.model(value, {parent: model, ...options});
    Object.defineProperty(m, "schema", {value: this});
    return m;
  }

  /** @override */
  toObject(value) {
    if ( !value ) return value;
    return value.toObject(false);
  }

  /** @override */
  migrateSource(sourceData, fieldData) {
    if ( fieldData ) this.model.migrateDataSafe(fieldData);
  }

  /** @override */
  _validateModel(changes, options) {
    this.model.validateJoint(changes);
  }
}

/* ---------------------------------------- */

/**
 * A subclass of [ArrayField]{@link ArrayField} which supports an embedded Document collection.
 * Invalid elements will be dropped from the collection during validation rather than failing for the field entirely.
 */
class EmbeddedCollectionField extends ArrayField {
  /**
   * @param {typeof foundry.abstract.Document} element  The type of Document which belongs to this embedded collection
   * @param {DataFieldOptions} [options]  Options which configure the behavior of the field
   * @param {DataFieldContext} [context]  Additional context which describes the field
   */
  constructor(element, options={}, context={}) {
    super(element, options, context);
    this.readonly = true; // Embedded collections are always immutable
  }

  /** @override */
  static _validateElementType(element) {
    if ( isSubclass(element, foundry.abstract.Document) ) return element;
    throw new Error("An EmbeddedCollectionField must specify a Document subclass as its type");
  }

  /**
   * The Collection implementation to use when initializing the collection.
   * @type {typeof EmbeddedCollection}
   */
  static get implementation() {
    return EmbeddedCollection;
  }

  /** @override */
  static hierarchical = true;

  /**
   * A reference to the DataModel subclass of the embedded document element
   * @type {typeof foundry.abstract.Document}
   */
  get model() {
    return this.element.implementation;
  }

  /**
   * The DataSchema of the contained Document model.
   * @type {SchemaField}
   */
  get schema() {
    return this.model.schema;
  }

  /** @inheritDoc */
  _cast(value) {
    if ( getType(value) !== "Map" ) return super._cast(value);
    const arr = [];
    for ( const [id, v] of value.entries() ) {
      if ( !("_id" in v) ) v._id = id;
      arr.push(v);
    }
    return super._cast(arr);
  }

  /** @override */
  _cleanType(value, options) {
    return value.map(v => this.schema.clean(v, {...options, source: v}));
  }

  /** @override */
  _validateElements(value, options) {
    const collectionFailure = new DataModelValidationFailure();
    for ( const v of value ) {
      const failure = this.schema.validate(v, {...options, source: v});
      if ( failure && !options.dropInvalidEmbedded ) {
        collectionFailure.elements.push({id: v._id, name: v.name, failure});
        collectionFailure.unresolved ||= failure.unresolved;
      }
    }
    if ( collectionFailure.elements.length ) return collectionFailure;
  }

  /** @override */
  initialize(value, model, options={}) {
    const collection = model.collections[this.name];
    collection.initialize(options);
    return collection;
  }

  /** @override */
  toObject(value) {
    return value.toObject(false);
  }

  /** @override */
  apply(fn, value=[], options={}) {

    // Apply to this EmbeddedCollectionField
    const thisFn = typeof fn === "string" ? this[fn] : fn;
    thisFn?.call(this, value, options);

    // Recursively apply to inner fields
    const results = [];
    if ( !value.length && options.initializeArrays ) value = [undefined];
    for ( const v of value ) {
      const r = this.schema.apply(fn, v, options);
      if ( !options.filter || !isEmpty(r) ) results.push(r);
    }
    return results;
  }

  /**
   * Migrate this field's candidate source data.
   * @param {object} sourceData   Candidate source data of the root model
   * @param {any} fieldData       The value of this field within the source data
   */
  migrateSource(sourceData, fieldData) {
    if ( fieldData instanceof Array ) {
      for ( const entry of fieldData ) this.model.migrateDataSafe(entry);
    }
  }

  /* -------------------------------------------- */
  /*  Embedded Document Operations                */
  /* -------------------------------------------- */

  /**
   * Return the embedded document(s) as a Collection.
   * @param {foundry.abstract.Document} parent  The parent document.
   * @returns {DocumentCollection}
   */
  getCollection(parent) {
    return parent[this.name];
  }
}

/* -------------------------------------------- */

/**
 * A subclass of {@link EmbeddedCollectionField} which manages a collection of delta objects relative to another
 * collection.
 */
class EmbeddedCollectionDeltaField extends EmbeddedCollectionField {
  /** @override */
  static get implementation() {
    return EmbeddedCollectionDelta;
  }

  /** @override */
  _cleanType(value, options) {
    return value.map(v => {
      if ( v._tombstone ) return foundry.data.TombstoneData.schema.clean(v, {...options, source: v});
      return this.schema.clean(v, {...options, source: v});
    });
  }

  /** @override */
  _validateElements(value, options) {
    const collectionFailure = new DataModelValidationFailure();
    for ( const v of value ) {
      const validationOptions = {...options, source: v};
      const failure = v._tombstone
        ? foundry.data.TombstoneData.schema.validate(v, validationOptions)
        : this.schema.validate(v, validationOptions);
      if ( failure && !options.dropInvalidEmbedded ) {
        collectionFailure.elements.push({id: v._id, name: v.name, failure});
        collectionFailure.unresolved ||= failure.unresolved;
      }
    }
    if ( collectionFailure.elements.length ) return collectionFailure;
  }
}

/* -------------------------------------------- */

/**
 * A subclass of {@link EmbeddedDataField} which supports a single embedded Document.
 */
class EmbeddedDocumentField extends EmbeddedDataField {
  /**
   * @param {typeof foundry.abstract.Document} model The type of Document which is embedded.
   * @param {DataFieldOptions} [options]  Options which configure the behavior of the field.
   * @param {DataFieldContext} [context]  Additional context which describes the field
   */
  constructor(model, options={}, context={}) {
    if ( !isSubclass(model, foundry.abstract.Document) ) {
      throw new Error("An EmbeddedDocumentField must specify a Document subclass as its type.");
    }
    super(model.implementation, options, context);
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      nullable: true
    });
  }

  /** @override */
  static hierarchical = true;

  /** @override */
  initialize(value, model, options={}) {
    if ( !value ) return value;
    if ( model[this.name] ) {
      model[this.name]._initialize(options);
      return model[this.name];
    }
    const m = new this.model(value, {...options, parent: model, parentCollection: this.name});
    Object.defineProperty(m, "schema", {value: this});
    return m;
  }

  /* -------------------------------------------- */
  /*  Embedded Document Operations                */
  /* -------------------------------------------- */

  /**
   * Return the embedded document(s) as a Collection.
   * @param {Document} parent  The parent document.
   * @returns {Collection<Document>}
   */
  getCollection(parent) {
    const collection = new SingletonEmbeddedCollection(this.name, parent, []);
    const doc = parent[this.name];
    if ( !doc ) return collection;
    collection.set(doc.id, doc);
    return collection;
  }
}

/* -------------------------------------------- */
/*  Special Field Types                         */
/* -------------------------------------------- */

/**
 * A subclass of [StringField]{@link StringField} which provides the primary _id for a Document.
 * The field may be initially null, but it must be non-null when it is saved to the database.
 */
class DocumentIdField extends StringField {

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      blank: false,
      nullable: true,
      initial: null,
      readonly: true,
      validationError: "is not a valid Document ID string"
    });
  }

  /** @override */
  _cast(value) {
    if ( value instanceof foundry.abstract.Document ) return value._id;
    else return String(value);
  }

  /** @override */
  _validateType(value) {
    if ( !isValidId(value) ) throw new Error("must be a valid 16-character alphanumeric ID");
  }
}

/* ---------------------------------------- */


/**
 * @typedef {Object} DocumentUUIDFieldOptions
 * @property {string} [type]            A specific document type in CONST.ALL_DOCUMENT_TYPES required by this field
 * @property {boolean} [embedded]       Does this field require (or prohibit) embedded documents?
 */

/**
 * A subclass of {@link StringField} which supports referencing some other Document by its UUID.
 * This field may not be blank, but may be null to indicate that no UUID is referenced.
 */
class DocumentUUIDField extends StringField {
  /**
   * @param {StringFieldOptions & DocumentUUIDFieldOptions} [options] Options which configure the behavior of the field
   * @param {DataFieldContext} [context]    Additional context which describes the field
   */
  constructor(options, context) {
    super(options, context);
  }

  /** @inheritdoc */
  static get _defaults() {
    return Object.assign(super._defaults, {
      required: true,
      blank: false,
      nullable: true,
      initial: null,
      type: undefined,
      embedded: undefined
    });
  }

  /** @override */
  _validateType(value) {
    const p = parseUuid(value);
    if ( this.type ) {
      if ( p.type !== this.type ) throw new Error(`Invalid document type "${p.type}" which must be a "${this.type}"`);
    }
    else if ( p.type && !ALL_DOCUMENT_TYPES.includes(p.type) ) throw new Error(`Invalid document type "${p.type}"`);
    if ( (this.embedded === true) && !p.embedded.length ) throw new Error("must be an embedded document");
    if ( (this.embedded === false) && p.embedded.length ) throw new Error("may not be an embedded document");
    if ( !isValidId(p.documentId) ) throw new Error(`Invalid document ID "${p.documentId}"`);
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /** @override */
  _toInput(config) {
    Object.assign(config, {type: this.type, single: true});
    return foundry.applications.elements.HTMLDocumentTagsElement.create(config);
  }
}

/* ---------------------------------------- */

/**
 * A special class of [StringField]{@link StringField} field which references another DataModel by its id.
 * This field may also be null to indicate that no foreign model is linked.
 */
class ForeignDocumentField extends DocumentIdField {
  /**
   * @param {typeof foundry.abstract.Document} model  The foreign DataModel class definition which this field links to
   * @param {StringFieldOptions} [options]    Options which configure the behavior of the field
   * @param {DataFieldContext} [context]      Additional context which describes the field
   */
  constructor(model, options={}, context={}) {
    super(options, context);
    if ( !isSubclass(model, DataModel) ) {
      throw new Error("A ForeignDocumentField must specify a DataModel subclass as its type");
    }
    /**
     * A reference to the model class which is stored in this field
     * @type {typeof foundry.abstract.Document}
     */
    this.model = model;
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      nullable: true,
      readonly: false,
      idOnly: false
    });
  }

  /** @override */
  _cast(value) {
    if ( typeof value === "string" ) return value;
    if ( (value instanceof this.model) ) return value._id;
    throw new Error(`The value provided to a ForeignDocumentField must be a ${this.model.name} instance.`);
  }

  /** @inheritdoc */
  initialize(value, model, options={}) {
    if ( this.idOnly ) return value;
    if ( model?.pack && !foundry.utils.isSubclass(this.model, foundry.documents.BaseFolder) ) return null;
    if ( !game.collections ) return value; // server-side
    return () => this.model?.get(value, {pack: model?.pack, ...options}) ?? null;
  }

  /** @inheritdoc */
  toObject(value) {
    return value?._id ?? value
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /** @override */
  _toInput(config) {

    // Prepare array of visible options
    const collection = game.collections.get(this.model.documentName);
    const current = collection.get(config.value);
    let hasCurrent = false;
    const options = collection.reduce((arr, doc) => {
      if ( !doc.visible ) return arr;
      if ( doc === current ) hasCurrent = true;
      arr.push({value: doc.id, label: doc.name});
      return arr;
    }, []);
    if ( current && !hasCurrent ) options.unshift({value: config.value, label: current.name});
    Object.assign(config, {options});

    // Allow blank
    if ( !this.required || this.nullable ) config.blank = "";

    // Create select input
    return foundry.applications.fields.createSelectInput(config);
  }
}

/* -------------------------------------------- */

/**
 * A special [StringField]{@link StringField} which records a standardized CSS color string.
 */
class ColorField extends StringField {

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      nullable: true,
      initial: null,
      blank: false,
      validationError: "is not a valid hexadecimal color string"
    });
  }

  /** @override */
  initialize(value, model, options={}) {
    if ( (value === null) || (value === undefined) ) return value;
    return Color.from(value);
  }

  /** @override */
  getInitialValue(data) {
    const value = super.getInitialValue(data);
    if ( (value === undefined) || (value === null) || (value === "") ) return value;
    const color = Color.from(value);
    if ( !color.valid ) throw new Error("Invalid initial value for ColorField");
    return color.css;
  }

  /** @override */
  _cast(value) {
    if ( value === "" ) return value;
    return Color.from(value);
  }

  /** @override */
  _cleanType(value, options) {
    if ( value === "" ) return value;
    if ( value.valid ) return value.css;
    return this.getInitialValue(options.source);
  }

  /** @inheritdoc */
  _validateType(value, options) {
    const result = super._validateType(value, options);
    if ( result !== undefined ) return result;
    if ( !isColorString(value) ) throw new Error("must be a valid color string");
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /** @override */
  _toInput(config) {
    if ( (config.placeholder === undefined) && !this.nullable && !(this.initial instanceof Function) ) {
      config.placeholder = this.initial;
    }
    return foundry.applications.elements.HTMLColorPickerElement.create(config);
  }
}

/* -------------------------------------------- */

/**
 * @typedef {StringFieldOptions} FilePathFieldOptions
 * @property {string[]} [categories]    A set of categories in CONST.FILE_CATEGORIES which this field supports
 * @property {boolean} [base64=false]   Is embedded base64 data supported in lieu of a file path?
 * @property {boolean} [wildcard=false] Does this file path field allow wildcard characters?
 * @property {object} [initial]         The initial values of the fields
 */

/**
 * A special [StringField]{@link StringField} which records a file path or inline base64 data.
 * @property {string[]} categories      A set of categories in CONST.FILE_CATEGORIES which this field supports
 * @property {boolean} base64=false     Is embedded base64 data supported in lieu of a file path?
 * @property {boolean} wildcard=false   Does this file path field allow wildcard characters?
 */
class FilePathField extends StringField {
  /**
   * @param {FilePathFieldOptions} [options]  Options which configure the behavior of the field
   * @param {DataFieldContext} [context]      Additional context which describes the field
   */
  constructor(options={}, context={}) {
    super(options, context);
    if ( !this.categories.length || this.categories.some(c => !(c in FILE_CATEGORIES)) ) {
      throw new Error("The categories of a FilePathField must be keys in CONST.FILE_CATEGORIES");
    }
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      categories: [],
      base64: false,
      wildcard: false,
      nullable: true,
      blank: false,
      initial: null
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _validateType(value) {

    // Wildcard paths
    if ( this.wildcard && value.includes("*") ) return true;

    // Allowed extension or base64
    const isValid = this.categories.some(c => {
      const category = FILE_CATEGORIES[c];
      if ( hasFileExtension(value, Object.keys(category)) ) return true;
      /**
       * If the field contains base64 data, it is allowed (for now) regardless of the base64 setting for the field.
       * Eventually, this will become more strict and only be valid if base64 is configured as true for the field.
       * @deprecated since v10
       */
      return isBase64Data(value, Object.values(category));
    });

    // Throw an error for invalid paths
    if ( !isValid ) {
      let err = "does not have a valid file extension";
      if ( this.base64 ) err += " or provide valid base64 data";
      throw new Error(err);
    }
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /** @override */
  _toInput(config) {
    // FIXME: This logic is fragile and would require a mapping between CONST.FILE_CATEGORIES and FilePicker.TYPES
    config.type = this.categories.length === 1 ? this.categories[0].toLowerCase() : "any";
    return foundry.applications.elements.HTMLFilePickerElement.create(config);
  }
}

/* -------------------------------------------- */

/**
 * A special {@link NumberField} which represents an angle of rotation in degrees between 0 and 360.
 * @property {boolean} normalize    Whether the angle should be normalized to [0,360) before being clamped to [0,360]. The default is true.
 */
class AngleField extends NumberField {
  constructor(options={}, context={}) {
    super(options, context)
    if ( "base" in this.options ) this.base = this.options.base;
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      nullable: false,
      initial: 0,
      normalize: true,
      min: 0,
      max: 360,
      validationError: "is not a number between 0 and 360"
    });
  }

  /** @inheritdoc */
  _cast(value) {
    value = super._cast(value);
    if ( !this.normalize ) return value;
    value = Math.normalizeDegrees(value);
    /** @deprecated since v12 */
    if ( (this.#base === 360) && (value === 0) ) value = 360;
    return value;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get base() {
    const msg = "The AngleField#base is deprecated in favor of AngleField#normalize.";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
    return this.#base;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  set base(v) {
    const msg = "The AngleField#base is deprecated in favor of AngleField#normalize.";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
    this.#base = v;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  #base = 0;
}

/* -------------------------------------------- */

/**
 * A special [NumberField]{@link NumberField} represents a number between 0 and 1.
 */
class AlphaField extends NumberField {
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      nullable: false,
      initial: 1,
      min: 0,
      max: 1,
      validationError: "is not a number between 0 and 1"
    });
  }
}

/* -------------------------------------------- */

/**
 * A special [NumberField]{@link NumberField} represents a number between 0 (inclusive) and 1 (exclusive).
 * Its values are normalized (modulo 1) to the range [0, 1) instead of being clamped.
 */
class HueField extends NumberField {
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
      max: 1,
      validationError: "is not a number between 0 (inclusive) and 1 (exclusive)"
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _cast(value) {
    value = super._cast(value) % 1;
    if ( value < 0 ) value += 1;
    return value;
  }
}

/* -------------------------------------------- */

/**
 * A special [ObjectField]{@link ObjectField} which captures a mapping of User IDs to Document permission levels.
 */
class DocumentOwnershipField extends ObjectField {

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      initial: {"default": DOCUMENT_OWNERSHIP_LEVELS.NONE},
      validationError: "is not a mapping of user IDs and document permission levels"
    });
  }

  /** @override */
  _validateType(value) {
    for ( let [k, v] of Object.entries(value) ) {
      if ( k.startsWith("-=") ) return isValidId(k.slice(2)) && (v === null);   // Allow removals
      if ( (k !== "default") && !isValidId(k) ) return false;
      if ( !Object.values(DOCUMENT_OWNERSHIP_LEVELS).includes(v) ) return false;
    }
  }
}

/* -------------------------------------------- */

/**
 * A special [StringField]{@link StringField} which contains serialized JSON data.
 */
class JSONField extends StringField {
  constructor(options, context) {
    super(options, context)
    this.blank = false;
    this.trim = false;
    this.choices = undefined;
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      blank: false,
      trim: false,
      initial: undefined,
      validationError: "is not a valid JSON string"
    });
  }

  /** @inheritdoc */
  clean(value, options) {
    if ( value === "" ) return '""';  // Special case for JSON fields
    return super.clean(value, options);
  }

  /** @override */
  _cast(value) {
    if ( (typeof value !== "string") || !isJSON(value) ) return JSON.stringify(value);
    return value;
  }

  /** @override */
  _validateType(value, options) {
    if ( (typeof value !== "string") || !isJSON(value) ) throw new Error("must be a serialized JSON string");
  }

  /** @override */
  initialize(value, model, options={}) {
    if ( (value === undefined) || (value === null) ) return value;
    return JSON.parse(value);
  }

  /** @override */
  toObject(value) {
    if ( (value === undefined) || (this.nullable && (value === null)) ) return value;
    return JSON.stringify(value);
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /** @override */
  _toInput(config) {
    if ( config.value !== "" ) config.value = JSON.stringify(config.value, null, 2);
    return foundry.applications.fields.createTextareaInput(config);
  }
}

/* -------------------------------------------- */

/**
 * A special subclass of {@link DataField} which can contain any value of any type.
 * Any input is accepted and is treated as valid.
 * It is not recommended to use this class except for very specific circumstances.
 */
class AnyField extends DataField {

  /** @override */
  _cast(value) {
    return value;
  }

  /** @override */
  _validateType(value) {
    return true;
  }
}


/* -------------------------------------------- */

/**
 * A subclass of [StringField]{@link StringField} which contains a sanitized HTML string.
 * This class does not override any StringField behaviors, but is used by the server-side to identify fields which
 * require sanitization of user input.
 */
class HTMLField extends StringField {

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      blank: true
    });
  }

  /** @override */
  toFormGroup(groupConfig={}, inputConfig) {
    groupConfig.stacked ??= true;
    return super.toFormGroup(groupConfig, inputConfig);
  }

  /** @override */
  _toInput(config) {
    return foundry.applications.elements.HTMLProseMirrorElement.create(config);
  }
}

/* ---------------------------------------- */

/**
 * A subclass of {@link NumberField} which is used for storing integer sort keys.
 */
class IntegerSortField extends NumberField {
  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      nullable: false,
      integer: true,
      initial: 0,
      label: "FOLDER.DocumentSort",
      hint: "FOLDER.DocumentSortHint"
    });
  }
}

/* ---------------------------------------- */

/**
 * @typedef {Object} DocumentStats
 * @property {string|null} coreVersion       The core version whose schema the Document data is in.
 *                                           It is NOT the version the Document was created or last modified in.
 * @property {string|null} systemId          The package name of the system the Document was created in.
 * @property {string|null} systemVersion     The version of the system the Document was created or last modified in.
 * @property {number|null} createdTime       A timestamp of when the Document was created.
 * @property {number|null} modifiedTime      A timestamp of when the Document was last modified.
 * @property {string|null} lastModifiedBy    The ID of the user who last modified the Document.
 * @property {string|null} compendiumSource  The UUID of the compendium Document this one was imported from.
 * @property {string|null} duplicateSource   The UUID of the Document this one is a duplicate of.
 */

/**
 * A subclass of {@link SchemaField} which stores document metadata in the _stats field.
 * @mixes DocumentStats
 */
class DocumentStatsField extends SchemaField {
  /**
   * @param {DataFieldOptions} [options]        Options which configure the behavior of the field
   * @param {DataFieldContext} [context]        Additional context which describes the field
   */
  constructor(options={}, context={}) {
    super({
      coreVersion: new StringField({required: true, blank: false, nullable: true, initial: () => game.release.version}),
      systemId: new StringField({required: true, blank: false, nullable: true, initial: () => game.system?.id ?? null}),
      systemVersion: new StringField({required: true, blank: false, nullable: true, initial: () => game.system?.version ?? null}),
      createdTime: new NumberField(),
      modifiedTime: new NumberField(),
      lastModifiedBy: new ForeignDocumentField(foundry.documents.BaseUser, {idOnly: true}),
      compendiumSource: new DocumentUUIDField(),
      duplicateSource: new DocumentUUIDField()
    }, options, context);
  }

  /**
   * All Document stats.
   * @type {string[]}
   */
  static fields = [
    "coreVersion", "systemId", "systemVersion", "createdTime", "modifiedTime", "lastModifiedBy", "compendiumSource",
    "duplicateSource"
  ];

  /**
   * These fields are managed by the server and are ignored if they appear in creation or update data.
   * @type {string[]}
   */
  static managedFields = ["coreVersion", "systemId", "systemVersion", "createdTime", "modifiedTime", "lastModifiedBy"];
}

/* ---------------------------------------- */

/**
 * A subclass of [StringField]{@link StringField} that is used specifically for the Document "type" field.
 */
class DocumentTypeField extends StringField {
  /**
   * @param {typeof foundry.abstract.Document} documentClass  The base document class which belongs in this field
   * @param {StringFieldOptions} [options]  Options which configure the behavior of the field
   * @param {DataFieldContext} [context]    Additional context which describes the field
   */
  constructor(documentClass, options={}, context={}) {
    options.choices = () => documentClass.TYPES;
    options.validationError = `is not a valid type for the ${documentClass.documentName} Document class`;
    super(options, context);
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      nullable: false,
      blank: false
    });
  }

  /** @override */
  _validateType(value, options) {
    if ( (typeof value !== "string") || !value ) throw new Error("must be a non-blank string");
    if ( this._isValidChoice(value) ) return true;
    // Allow unrecognized types if we are allowed to fallback (non-strict validation)
    if (options.fallback ) return true;
    throw new Error(`"${value}" ${this.options.validationError}`);
  }
}

/* ---------------------------------------- */

/**
 * A subclass of [ObjectField]{@link ObjectField} which supports a type-specific data object.
 */
class TypeDataField extends ObjectField {
  /**
   * @param {typeof foundry.abstract.Document} document  The base document class which belongs in this field
   * @param {DataFieldOptions} [options]    Options which configure the behavior of the field
   * @param {DataFieldContext} [context]    Additional context which describes the field
   */
  constructor(document, options={}, context={}) {
    super(options, context);
    /**
     * The canonical document name of the document type which belongs in this field
     * @type {typeof foundry.abstract.Document}
     */
    this.document = document;
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {required: true});
  }

  /** @override */
  static recursive = true;

  /**
   * Return the package that provides the sub-type for the given model.
   * @param {DataModel} model       The model instance created for this sub-type.
   * @returns {System|Module|null}
   */
  static getModelProvider(model) {
    const document = model.parent;
    if ( !document ) return null;
    const documentClass = document.constructor;
    const documentName = documentClass.documentName;
    const type = document.type;

    // Unrecognized type
    if ( !documentClass.TYPES.includes(type) ) return null;

    // Core-defined sub-type
    const coreTypes = documentClass.metadata.coreTypes;
    if ( coreTypes.includes(type) ) return null;

    // System-defined sub-type
    const systemTypes = game.system.documentTypes[documentName];
    if ( systemTypes && (type in systemTypes) ) return game.system;

    // Module-defined sub-type
    const moduleId = type.substring(0, type.indexOf("."));
    return game.modules.get(moduleId) ?? null;
  }

  /**
   * A convenience accessor for the name of the document type associated with this TypeDataField
   * @type {string}
   */
  get documentName() {
    return this.document.documentName;
  }

  /**
   * Get the DataModel definition that should be used for this type of document.
   * @param {string} type              The Document instance type
   * @returns {typeof DataModel|null}  The DataModel class or null
   */
  getModelForType(type) {
    if ( !type ) return null;
    return globalThis.CONFIG?.[this.documentName]?.dataModels?.[type] ?? null;
  }

  /** @override */
  getInitialValue(data) {
    const cls = this.getModelForType(data.type);
    if ( cls ) return cls.cleanData();
    const template = game?.model[this.documentName]?.[data.type];
    if ( template ) return foundry.utils.deepClone(template);
    return {};
  }

  /** @override */
  _cleanType(value, options) {
    if ( !(typeof value === "object") ) value = {};

    // Use a defined DataModel
    const type = options.source?.type;
    const cls = this.getModelForType(type);
    if ( cls ) return cls.cleanData(value, {...options, source: value});
    if ( options.partial ) return value;

    // Use the defined template.json
    const template = this.getInitialValue(options.source);
    const insertKeys = (type === BASE_DOCUMENT_TYPE) || !game?.system?.strictDataCleaning;
    return mergeObject(template, value, {insertKeys, inplace: true});
  }

  /** @override */
  initialize(value, model, options={}) {
    const cls = this.getModelForType(model._source.type);
    if ( cls ) {
      const instance = new cls(value, {parent: model, ...options});
      if ( !("modelProvider" in instance) ) Object.defineProperty(instance, "modelProvider", {
        value: this.constructor.getModelProvider(instance),
        writable: false
      });
      return instance;
    }
    return deepClone(value);
  }

  /** @inheritdoc */
  _validateType(data, options={}) {
    const result = super._validateType(data, options);
    if ( result !== undefined ) return result;
    const cls = this.getModelForType(options.source?.type);
    const schema = cls?.schema;
    return schema?.validate(data, {...options, source: data});
  }

  /* ---------------------------------------- */

  /** @override */
  _validateModel(changes, options={}) {
    const cls = this.getModelForType(options.source?.type);
    return cls?.validateJoint(changes);
  }

  /* ---------------------------------------- */

  /** @override */
  toObject(value) {
    return value.toObject instanceof Function ? value.toObject(false) : deepClone(value);
  }

  /**
   * Migrate this field's candidate source data.
   * @param {object} sourceData   Candidate source data of the root model
   * @param {any} fieldData       The value of this field within the source data
   */
  migrateSource(sourceData, fieldData) {
    const cls = this.getModelForType(sourceData.type);
    if ( cls ) cls.migrateDataSafe(fieldData);
  }
}

/* ---------------------------------------- */

/**
 * A subclass of [DataField]{@link DataField} which allows to typed schemas.
 */
class TypedSchemaField extends DataField {
  /**
   * @param {{[type: string]: DataSchema|SchemaField|typeof DataModel}} types    The different types this field can represent.
   * @param {DataFieldOptions} [options]                                         Options which configure the behavior of the field
   * @param {DataFieldContext} [context]                                         Additional context which describes the field
   */
  constructor(types, options, context) {
    super(options, context);
    this.types = this.#configureTypes(types);
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {required: true});
  }

  /* ---------------------------------------- */

  /**
  * The types of this field.
  * @type {{[type: string]: SchemaField}}
  */
  types;

  /* -------------------------------------------- */

  /**
   * Initialize and validate the structure of the provided type definitions.
   * @param {{[type: string]: DataSchema|SchemaField|typeof DataModel}} types    The provided field definitions
   * @returns {{[type: string]: SchemaField}}                                     The validated fields
   */
  #configureTypes(types) {
    if ( (typeof types !== "object") ) {
      throw new Error("A DataFields must be an object with string keys and DataField values.");
    }
    types = {...types};
    for ( let [type, field] of Object.entries(types) ) {
      if ( isSubclass(field, DataModel) ) field = new EmbeddedDataField(field);
      if ( field?.constructor?.name === "Object" ) {
        const schema = {...field};
        if ( !("type" in schema) ) {
          schema.type = new StringField({required: true, blank: false, initial: field,
            validate: value => value === type, validationError: `must be equal to "${type}"`});
        }
        field = new SchemaField(schema);
      }
      if ( !(field instanceof SchemaField)  ) {
        throw new Error(`The "${type}" field is not an instance of the SchemaField class or a subclass of DataModel.`);
      }
      if ( field.name !== undefined ) throw new Error(`The "${field.fieldPath}" field must not have a name.`);
      if ( field.parent !== undefined ) {
        throw new Error(`The "${field.fieldPath}" field already belongs to some other parent and may not be reused.`);
      }
      types[type] = field;
      field.parent = this;
      if ( !field.required ) throw new Error(`The "${field.fieldPath}" field must be required.`);
      if ( field.nullable ) throw new Error(`The "${field.fieldPath}" field must not be nullable.`);
      const typeField = field.fields.type;
      if ( !(typeField instanceof StringField) ) throw new Error(`The "${field.fieldPath}" field must have a "type" StringField.`);
      if ( !typeField.required ) throw new Error(`The "${typeField.fieldPath}" field must be required.`);
      if ( typeField.nullable ) throw new Error(`The "${typeField.fieldPath}" field must not be nullable.`);
      if ( typeField.blank ) throw new Error(`The "${typeField.fieldPath}" field must not be blank.`);
      if ( typeField.validate(type, {fallback: false}) !== undefined ) throw new Error(`"${type}" must be a valid type of "${typeField.fieldPath}".`);
    }
    return types;
  }

  /* ---------------------------------------- */

  /** @override */
  _getField(path) {
    if ( !path.length ) return this;
    return this.types[path.shift()]?._getField(path);
  }

  /* -------------------------------------------- */
  /*  Data Field Methods                          */
  /* -------------------------------------------- */

  /** @override */
  _cleanType(value, options) {
    const field = this.types[value?.type];
    if ( !field ) return value;
    return field.clean(value, options);
  }

  /* ---------------------------------------- */

  /** @override */
  _cast(value) {
    return typeof value === "object" ? value : {};
  }

  /* ---------------------------------------- */

  /** @override */
  _validateSpecial(value) {
    const result = super._validateSpecial(value);
    if ( result !== undefined ) return result;
    const field = this.types[value?.type];
    if ( !field ) throw new Error("does not have a valid type");
  }

  /* ---------------------------------------- */

  /** @override */
  _validateType(value, options) {
    return this.types[value.type].validate(value, options);
  }

  /* ---------------------------------------- */

  /** @override */
  initialize(value, model, options) {
    const field = this.types[value?.type];
    if ( !field ) return value;
    return field.initialize(value, model, options);
  }

  /* ---------------------------------------- */

  /** @override */
  toObject(value) {
    if ( !value ) return value;
    return this.types[value.type]?.toObject(value) ?? value;
  }

  /* -------------------------------------------- */

  /** @override */
  apply(fn, data, options) {

    // Apply to this TypedSchemaField
    const thisFn = typeof fn === "string" ? this[fn] : fn;
    thisFn?.call(this, data, options);

    // Apply to the inner typed field
    const typeField = this.types[data?.type];
    return typeField?.apply(fn, data, options);
  }

  /* -------------------------------------------- */

  /**
   * Migrate this field's candidate source data.
   * @param {object} sourceData   Candidate source data of the root model
   * @param {any} fieldData       The value of this field within the source data
   */
  migrateSource(sourceData, fieldData) {
    const field = this.types[fieldData?.type];
    const canMigrate = field?.migrateSource instanceof Function;
    if ( canMigrate ) field.migrateSource(sourceData, fieldData);
  }
}

/* ---------------------------------------- */
/*  DEPRECATIONS                            */
/* ---------------------------------------- */

/**
 * @deprecated since v11
 * @see DataModelValidationError
 * @ignore
 */
class ModelValidationError extends Error {
  constructor(errors) {
    logCompatibilityWarning(
      "ModelValidationError is deprecated. Please use DataModelValidationError instead.",
      {since: 11, until: 13});
    const message = ModelValidationError.formatErrors(errors);
    super(message);
    this.errors = errors;
  }

  /**
   * Collect all the errors into a single message for consumers who do not handle the ModelValidationError specially.
   * @param {Record<string, Error>|Error[]|string} errors   The raw error structure
   * @returns {string}                              A formatted error message
   */
  static formatErrors(errors) {
    if ( typeof errors === "string" ) return errors;
    const message = ["Model Validation Errors"];
    if ( errors instanceof Array ) message.push(...errors.map(e => e.message));
    else message.push(...Object.entries(errors).map(([k, e]) => `[${k}]: ${e.message}`));
    return message.join("\n");
  }
}

/* -------------------------------------------- */


/**
 * @typedef {Object} JavaScriptFieldOptions
 * @property {boolean} [async=false]            Does the field allow async code?
 */

/**
 * A subclass of {@link StringField} which contains JavaScript code.
 */
class JavaScriptField extends StringField {
  /**
   * @param {StringFieldOptions & JavaScriptFieldOptions} [options] Options which configure the behavior of the field
   * @param {DataFieldContext} [context]    Additional context which describes the field
   */
  constructor(options, context) {
    super(options, context);
    this.choices = undefined;
  }

  /** @inheritdoc */
  static get _defaults() {
    return mergeObject(super._defaults, {
      required: true,
      blank: true,
      nullable: false,
      async: false
    });
  }

  /** @inheritdoc */
  _validateType(value, options) {
    const result = super._validateType(value, options);
    if ( result !== undefined ) return result;
    try {
      new (this.async ? AsyncFunction : Function)(value);
    } catch(err) {
      const scope = this.async ? "an asynchronous" : "a synchronous";
      err.message = `must be valid JavaScript for ${scope} scope:\n${err.message}`;
      throw new Error(err);
    }
  }

  /* -------------------------------------------- */
  /*  Form Field Integration                      */
  /* -------------------------------------------- */

  /** @override */
  toFormGroup(groupConfig={}, inputConfig) {
    groupConfig.stacked ??= true;
    return super.toFormGroup(groupConfig, inputConfig);
  }

  /** @override */
  _toInput(config) {
    return foundry.applications.fields.createTextareaInput(config);
  }
}

// Exports need to be at the bottom so that class names appear correctly in JSDoc
export {
  AlphaField,
  AngleField,
  AnyField,
  ArrayField,
  BooleanField,
  ColorField,
  DataField,
  DocumentIdField,
  DocumentOwnershipField,
  DocumentStatsField,
  DocumentTypeField,
  DocumentUUIDField,
  EmbeddedDataField,
  EmbeddedCollectionField,
  EmbeddedCollectionDeltaField,
  EmbeddedDocumentField,
  FilePathField,
  ForeignDocumentField,
  HTMLField,
  HueField,
  IntegerSortField,
  JavaScriptField,
  JSONField,
  NumberField,
  ObjectField,
  TypedSchemaField,
  SchemaField,
  SetField,
  StringField,
  TypeDataField,
  ModelValidationError
}
