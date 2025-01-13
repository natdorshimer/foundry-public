import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import {LightData} from "../data/data.mjs";

/**
 * @typedef {import("./_types.mjs").AmbientLightData} AmbientLightData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The AmbientLight Document.
 * Defines the DataSchema and common behaviors for an AmbientLight which are shared between both client and server.
 * @mixes AmbientLightData
 */
export default class BaseAmbientLight extends Document {
  /**
   * Construct an AmbientLight document using provided data and context.
   * @param {Partial<AmbientLightData>} data        Initial data from which to construct the AmbientLight
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
    name: "AmbientLight",
    collection: "lights",
    label: "DOCUMENT.AmbientLight",
    labelPlural: "DOCUMENT.AmbientLights",
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      x: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0}),
      y: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0}),
      elevation: new fields.NumberField({required: true, nullable: false, initial: 0}),
      rotation: new fields.AngleField(),
      walls: new fields.BooleanField({initial: true}),
      vision: new fields.BooleanField(),
      config: new fields.EmbeddedDataField(LightData),
      hidden: new fields.BooleanField(),
      flags: new fields.ObjectField()
    }
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["AMBIENT_LIGHT"];
}
