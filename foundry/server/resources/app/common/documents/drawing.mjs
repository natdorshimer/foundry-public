import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import * as documents from "./_module.mjs";
import * as CONST from "../constants.mjs";
import {ShapeData} from "../data/data.mjs";

/**
 * @typedef {import("./_types.mjs").DrawingData} DrawingData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Drawing Document.
 * Defines the DataSchema and common behaviors for a Drawing which are shared between both client and server.
 * @mixes DrawingData
 */
export default class BaseDrawing extends Document {
  /**
   * Construct a Drawing document using provided data and context.
   * @param {Partial<DrawingData>} data             Initial data from which to construct the Drawing
   * @param {DocumentConstructionContext} context   Construction context options
   */
  constructor(data, context) {
    super(data, context);
  }

  /* ---------------------------------------- */
  /*  Model Configuration                     */
  /* ---------------------------------------- */

  /** @inheritdoc */
  static metadata = Object.freeze(mergeObject(super.metadata, {
    name: "Drawing",
    collection: "drawings",
    label: "DOCUMENT.Drawing",
    labelPlural: "DOCUMENT.Drawings",
    isEmbedded: true,
    permissions: {
      create: this.#canCreate,
      update: this.#canUpdate
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /* ---------------------------------------- */

  /** @inheritDoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      author: new fields.ForeignDocumentField(documents.BaseUser, {nullable: false, initial: () => game.user?.id}),
      shape: new fields.EmbeddedDataField(ShapeData),
      x: new fields.NumberField({required: true, nullable: false, initial: 0, label: "XCoord"}),
      y: new fields.NumberField({required: true, nullable: false, initial: 0, label: "YCoord"}),
      elevation: new fields.NumberField({required: true, nullable: false, initial: 0}),
      sort: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0}),
      rotation: new fields.AngleField({label: "DRAWING.Rotation"}),
      bezierFactor: new fields.AlphaField({initial: 0, label: "DRAWING.SmoothingFactor", max: 0.5,
        hint: "DRAWING.SmoothingFactorHint"}),
      fillType: new fields.NumberField({required: true, nullable: false, initial: CONST.DRAWING_FILL_TYPES.NONE,
        choices: Object.values(CONST.DRAWING_FILL_TYPES), label: "DRAWING.FillTypes",
        validationError: "must be a value in CONST.DRAWING_FILL_TYPES"
      }),
      fillColor: new fields.ColorField({nullable: false, initial: () => game.user?.color.css || "#ffffff", label: "DRAWING.FillColor"}),
      fillAlpha: new fields.AlphaField({initial: 0.5, label: "DRAWING.FillOpacity"}),
      strokeWidth: new fields.NumberField({nullable: false, integer: true, initial: 8, min: 0, label: "DRAWING.LineWidth"}),
      strokeColor: new fields.ColorField({nullable: false, initial: () => game.user?.color.css || "#ffffff", label: "DRAWING.StrokeColor"}),
      strokeAlpha: new fields.AlphaField({initial: 1, label: "DRAWING.LineOpacity"}),
      texture: new fields.FilePathField({categories: ["IMAGE"], label: "DRAWING.FillTexture"}),
      text: new fields.StringField({label: "DRAWING.TextLabel"}),
      fontFamily: new fields.StringField({blank: false, label: "DRAWING.FontFamily",
        initial: () => globalThis.CONFIG?.defaultFontFamily || "Signika"}),
      fontSize: new fields.NumberField({nullable: false, integer: true, min: 8, max: 256, initial: 48, label: "DRAWING.FontSize",
        validationError: "must be an integer between 8 and 256"}),
      textColor: new fields.ColorField({nullable: false, initial: "#ffffff", label: "DRAWING.TextColor"}),
      textAlpha: new fields.AlphaField({label: "DRAWING.TextOpacity"}),
      hidden: new fields.BooleanField(),
      locked: new fields.BooleanField(),
      interface: new fields.BooleanField(),
      flags: new fields.ObjectField()
    }
  }

  /* ---------------------------------------- */

  /**
   * Validate whether the drawing has some visible content (as required by validation).
   * @returns {boolean}
   */
  static #validateVisibleContent(data) {
    const hasText = (data.text !== "") && (data.textAlpha > 0);
    const hasFill = (data.fillType !== CONST.DRAWING_FILL_TYPES.NONE) && (data.fillAlpha > 0);
    const hasLine = (data.strokeWidth > 0) && (data.strokeAlpha > 0);
    return hasText || hasFill || hasLine;
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static validateJoint(data) {
    if ( !BaseDrawing.#validateVisibleContent(data) ) {
      throw new Error(game.i18n.localize("DRAWING.JointValidationError"));
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static canUserCreate(user) {
    return user.hasPermission("DRAWING_CREATE");
  }

  /* ---------------------------------------- */

  /**
   * Is a user able to create a new Drawing?
   * @param {User} user            The user attempting the creation operation.
   * @param {BaseDrawing} doc      The Drawing being created.
   * @returns {boolean}
   */
  static #canCreate(user, doc) {
    if ( !user.isGM && (doc._source.author !== user.id) ) return false;
    return user.hasPermission("DRAWING_CREATE");
  }

  /* ---------------------------------------- */

  /**
   * Is a user able to update the Drawing document?
   */
  static #canUpdate(user, doc, data) {
    if ( !user.isGM && ("author" in data) && (data.author !== user.id) ) return false;
    return doc.testUserPermission(user, "OWNER");
  }

  /* ---------------------------------------- */
  /*  Model Methods                           */
  /* ---------------------------------------- */

  /** @inheritdoc */
  testUserPermission(user, permission, {exact=false}={}) {
    if ( !exact && (user.id === this._source.author) ) return true; // The user who created the drawing
    return super.testUserPermission(user, permission, {exact});
  }

  /* ---------------------------------------- */
  /*  Deprecations and Compatibility          */
  /* ---------------------------------------- */

  /** @inheritdoc */
  static migrateData(data) {
    /**
     * V12 migration to elevation and sort fields
     * @deprecated since v12
     */
    this._addDataFieldMigration(data, "z", "elevation");
    return super.migrateData(data);
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static shimData(data, options) {
    this._addDataFieldShim(data, "z", "elevation", {since: 12, until: 14});
    return super.shimData(data, options);
  }

  /* ---------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get z() {
    this.constructor._logDataFieldMigration("z", "elevation", {since: 12, until: 14});
    return this.elevation;
  }
}
