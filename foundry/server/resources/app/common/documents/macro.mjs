import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as CONST from "../constants.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";

/**
 * @typedef {import("./_types.mjs").MacroData} MacroData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Macro Document.
 * Defines the DataSchema and common behaviors for a Macro which are shared between both client and server.
 * @mixes MacroData
 */
export default class BaseMacro extends Document {
  /**
   * Construct a Macro document using provided data and context.
   * @param {Partial<MacroData>} data               Initial data from which to construct the Macro
   * @param {DocumentConstructionContext} context   Construction context options
   */
  constructor(data, context) {
    super(data, context);
  }

  /* -------------------------------------------- */
  /*  Model Configuration                         */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static metadata = Object.freeze(mergeObject(super.metadata, {
    name: "Macro",
    collection: "macros",
    indexed: true,
    compendiumIndexFields: ["_id", "name", "img", "sort", "folder"],
    label: "DOCUMENT.Macro",
    labelPlural: "DOCUMENT.Macros",
    coreTypes: Object.values(CONST.MACRO_TYPES),
    permissions: {
      create: this.#canCreate,
      update: this.#canUpdate
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, label: "Name", textSearch: true}),
      type: new fields.DocumentTypeField(this, {initial: CONST.MACRO_TYPES.CHAT, label: "Type"}),
      author: new fields.ForeignDocumentField(documents.BaseUser, {initial: () => game?.user?.id}),
      img: new fields.FilePathField({categories: ["IMAGE"], initial: () => this.DEFAULT_ICON, label: "Image"}),
      scope: new fields.StringField({required: true, choices: CONST.MACRO_SCOPES, initial: CONST.MACRO_SCOPES[0],
        validationError: "must be a value in CONST.MACRO_SCOPES", label: "Scope"}),
      command: new fields.StringField({required: true, blank: true, label: "Command"}),
      folder: new fields.ForeignDocumentField(documents.BaseFolder),
      sort: new fields.IntegerSortField(),
      ownership: new fields.DocumentOwnershipField(),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
  }

  /**
   * The default icon used for newly created Macro documents.
   * @type {string}
   */
  static DEFAULT_ICON = "icons/svg/dice-target.svg";

  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    /**
     * Migrate sourceId.
     * @deprecated since v12
     */
    this._addDataFieldMigration(source, "flags.core.sourceId", "_stats.compendiumSource");

    return super.migrateData(source);
  }

  /* -------------------------------------------- */
  /*  Model Methods                               */
  /* -------------------------------------------- */

  /** @override */
  static validateJoint(data) {
    if ( data.type !== CONST.MACRO_TYPES.SCRIPT ) return;
    const field = new fields.JavaScriptField({ async: true });
    const failure = field.validate(data.command);
    if ( failure ) throw failure.asError();
  }

  /* -------------------------------------------- */

  /** @override */
  static canUserCreate(user) {
    return user.hasRole("PLAYER");
  }

  /* ---------------------------------------- */

  /**
   * Is a user able to create the Macro document?
   */
  static #canCreate(user, doc) {
    if ( !user.isGM && (doc._source.author !== user.id) ) return false;
    if ( (doc._source.type === "script") && !user.hasPermission("MACRO_SCRIPT") ) return false;
    return user.hasRole("PLAYER");
  }

  /* ---------------------------------------- */

  /**
   * Is a user able to update the Macro document?
   */
  static #canUpdate(user, doc, data) {
    if ( !user.isGM && ("author" in data) && (data.author !== user.id) ) return false;
    if ( !user.hasPermission("MACRO_SCRIPT") ) {
      if ( data.type === "script" ) return false;
      if ( (doc._source.type === "script") && ("command" in data) ) return false;
    }
    return doc.testUserPermission(user, "OWNER");
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  testUserPermission(user, permission, {exact=false}={}) {
    if ( !exact && (user.id === this._source.author) ) return true; // Macro authors can edit
    return super.testUserPermission(user, permission, {exact});
  }

  /* -------------------------------------------- */
  /*  Database Event Handlers                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;
    this.updateSource({author: user.id});
  }
}
