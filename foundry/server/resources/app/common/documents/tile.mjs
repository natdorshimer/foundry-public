import Document from "../abstract/document.mjs";
import {getProperty, hasProperty, mergeObject} from "../utils/helpers.mjs";
import * as CONST from "../constants.mjs";
import * as fields from "../data/fields.mjs";
import {TextureData} from "../data/data.mjs";

/**
 * @typedef {import("./_types.mjs").TileData} TileData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Tile Document.
 * Defines the DataSchema and common behaviors for a Tile which are shared between both client and server.
 * @mixes TileData
 */
export default class BaseTile extends Document {
  /**
   * Construct a Tile document using provided data and context.
   * @param {Partial<TileData>} data                Initial data from which to construct the Tile
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
    name: "Tile",
    collection: "tiles",
    label: "DOCUMENT.Tile",
    labelPlural: "DOCUMENT.Tiles",
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      texture: new TextureData({}, {initial: {anchorX: 0.5, anchorY: 0.5, alphaThreshold: 0.75}}),
      width: new fields.NumberField({required: true, min: 0, nullable: false, step: 0.1}),
      height: new fields.NumberField({required: true, min: 0, nullable: false, step: 0.1}),
      x: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0, label: "XCoord"}),
      y: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0, label: "YCoord"}),
      elevation: new fields.NumberField({required: true, nullable: false, initial: 0}),
      sort: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0}),
      rotation: new fields.AngleField(),
      alpha: new fields.AlphaField(),
      hidden: new fields.BooleanField(),
      locked: new fields.BooleanField(),
      restrictions: new fields.SchemaField({
        light: new fields.BooleanField(),
        weather: new fields.BooleanField()
      }),
      occlusion: new fields.SchemaField({
        mode: new fields.NumberField({choices: Object.values(CONST.OCCLUSION_MODES),
          initial: CONST.OCCLUSION_MODES.NONE,
          validationError: "must be a value in CONST.TILE_OCCLUSION_MODES"}),
        alpha: new fields.AlphaField({initial: 0})
      }),
      video: new fields.SchemaField({
        loop: new fields.BooleanField({initial: true}),
        autoplay: new fields.BooleanField({initial: true}),
        volume: new fields.AlphaField({initial: 0, step: 0.01})
      }),
      flags: new fields.ObjectField()
    }
  }


  /* ---------------------------------------- */
  /*  Deprecations and Compatibility          */
  /* ---------------------------------------- */

  /** @inheritdoc */
  static migrateData(data) {
    /**
     * V12 migration to elevation and sort
     * @deprecated since v12
     */
    this._addDataFieldMigration(data, "z", "sort");

    /**
     * V12 migration from roof to restrictions.light and restrictions.weather
     * @deprecated since v12
     */
    if ( foundry.utils.hasProperty(data, "roof") ) {
      const value = foundry.utils.getProperty(data, "roof");
      if ( !foundry.utils.hasProperty(data, "restrictions.light") ) foundry.utils.setProperty(data, "restrictions.light", value);
      if ( !foundry.utils.hasProperty(data, "restrictions.weather") ) foundry.utils.setProperty(data, "restrictions.weather", value);
      delete data["roof"];
    }

    return super.migrateData(data);
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static shimData(data, options) {
    this._addDataFieldShim(data, "z", "sort", {since: 12, until: 14});
    return super.shimData(data, options);
  }

  /* ---------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  set roof(enabled) {
    this.constructor._logDataFieldMigration("roof", "restrictions.{light|weather}", {since: 12, until: 14});
    this.restrictions.light = enabled;
    this.restrictions.weather = enabled;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  get roof() {
    this.constructor._logDataFieldMigration("roof", "restrictions.{light|weather}", {since: 12, until: 14});
    return this.restrictions.light && this.restrictions.weather;
  }

  /* ---------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get z() {
    this.constructor._logDataFieldMigration("z", "sort", {since: 12, until: 14});
    return this.sort;
  }

  /* ---------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get overhead() {
    foundry.utils.logCompatibilityWarning(`${this.constructor.name}#overhead is deprecated.`, {since: 12, until: 14})
    return this.elevation >= this.parent?.foregroundElevation;
  }
}
