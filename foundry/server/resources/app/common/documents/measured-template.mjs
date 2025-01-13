import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as CONST from "../constants.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";

/**
 * @typedef {import("./_types.mjs").MeasuredTemplateData} MeasuredTemplateData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The MeasuredTemplate Document.
 * Defines the DataSchema and common behaviors for a MeasuredTemplate which are shared between both client and server.
 * @mixes MeasuredTemplateData
 */
export default class BaseMeasuredTemplate extends Document {
  /**
   * Construct a MeasuredTemplate document using provided data and context.
   * @param {Partial<MeasuredTemplateData>} data    Initial data from which to construct the MeasuredTemplate
   * @param {DocumentConstructionContext} context   Construction context options
   */
  constructor(data, context) {
    super(data, context);
  }

  /* -------------------------------------------- */
  /*  Model Configuration                         */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static metadata = mergeObject(super.metadata, {
    name: "MeasuredTemplate",
    collection: "templates",
    label: "DOCUMENT.MeasuredTemplate",
    labelPlural: "DOCUMENT.MeasuredTemplates",
    isEmbedded: true,
    permissions: {
      create: this.#canCreate,
      update: this.#canUpdate
    },
    schemaVersion: "12.324"
  }, {inplace: false});

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      author: new fields.ForeignDocumentField(documents.BaseUser, {initial: () => game?.user?.id}),
      t: new fields.StringField({required: true, choices: Object.values(CONST.MEASURED_TEMPLATE_TYPES), label: "Type",
        initial: CONST.MEASURED_TEMPLATE_TYPES.CIRCLE,
        validationError: "must be a value in CONST.MEASURED_TEMPLATE_TYPES",
      }),
      x: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0, label: "XCoord"}),
      y: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0, label: "YCoord"}),
      elevation: new fields.NumberField({required: true, nullable: false, initial: 0}),
      sort: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0}),
      distance: new fields.NumberField({required: true, nullable: false, initial: 0, min: 0, label: "Distance"}),
      direction: new fields.AngleField({label: "Direction"}),
      angle: new fields.AngleField({normalize: false, label: "Angle"}),
      width: new fields.NumberField({required: true, nullable: false, initial: 0, min: 0, step: 0.01, label: "Width"}),
      borderColor: new fields.ColorField({nullable: false, initial: "#000000"}),
      fillColor: new fields.ColorField({nullable: false, initial: () => game.user?.color.css || "#ffffff"}),
      texture: new fields.FilePathField({categories: ["IMAGE", "VIDEO"]}),
      hidden: new fields.BooleanField({label: "Hidden"}),
      flags: new fields.ObjectField()
    }
  }

  /* ---------------------------------------- */

  /**
   * Is a user able to create a new MeasuredTemplate?
   * @param {User} user                     The user attempting the creation operation.
   * @param {BaseMeasuredTemplate} doc      The MeasuredTemplate being created.
   * @returns {boolean}
   */
  static #canCreate(user, doc) {
    if ( !user.isGM && (doc._source.author !== user.id) ) return false;
    return user.hasPermission("TEMPLATE_CREATE");
  }

  /* ---------------------------------------- */

  /**
   * Is a user able to update the MeasuredTemplate document?
   */
  static #canUpdate(user, doc, data) {
    if ( !user.isGM && ("author" in data) && (data.author !== user.id) ) return false;
    return doc.testUserPermission(user, "OWNER");
  }

  /* -------------------------------------------- */
  /*  Model Methods                               */
  /* -------------------------------------------- */

  /** @inheritdoc */
  testUserPermission(user, permission, {exact=false}={}) {
    if ( !exact && (user.id === this._source.author) ) return true; // The user who created the template
    return super.testUserPermission(user, permission, {exact});
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static migrateData(data) {
    /**
     * V12 migration from user to author
     * @deprecated since v12
     */
    this._addDataFieldMigration(data, "user", "author");
    return super.migrateData(data);
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static shimData(data, options) {
    this._addDataFieldShim(data, "user", "author", {since: 12, until: 14})
    return super.shimData(data, options);
  }

  /* ---------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get user() {
    this.constructor._logDataFieldMigration("user", "author", {since: 12, until: 14});
    return this.author;
  }
}
