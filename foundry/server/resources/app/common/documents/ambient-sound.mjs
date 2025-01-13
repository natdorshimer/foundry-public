import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";

/**
 * @typedef {import("./_types.mjs").AmbientSoundData} AmbientSoundData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The AmbientSound Document.
 * Defines the DataSchema and common behaviors for an AmbientSound which are shared between both client and server.
 * @mixes AmbientSoundData
 */
export default class BaseAmbientSound extends Document {
  /**
   * Construct an AmbientSound document using provided data and context.
   * @param {Partial<AmbientSoundData>} data        Initial data from which to construct the AmbientSound
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
    name: "AmbientSound",
    collection: "sounds",
    label: "DOCUMENT.AmbientSound",
    labelPlural: "DOCUMENT.AmbientSounds",
    isEmbedded: true,
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      x: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0}),
      y: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0}),
      elevation: new fields.NumberField({required: true, nullable: false, initial: 0}),
      radius: new fields.NumberField({required: true, nullable: false, initial: 0, min: 0, step: 0.01}),
      path: new fields.FilePathField({categories: ["AUDIO"]}),
      repeat: new fields.BooleanField(),
      volume: new fields.AlphaField({initial: 0.5, step: 0.01}),
      walls: new fields.BooleanField({initial: true}),
      easing: new fields.BooleanField({initial: true}),
      hidden: new fields.BooleanField(),
      darkness: new fields.SchemaField({
        min: new fields.AlphaField({initial: 0}),
        max: new fields.AlphaField({initial: 1})
      }),
      effects: new fields.SchemaField({
        base: new fields.SchemaField({
          type: new fields.StringField(),
          intensity: new fields.NumberField({required: true, integer: true, initial: 5, min: 1, max: 10, step: 1})
        }),
        muffled: new fields.SchemaField({
          type: new fields.StringField(),
          intensity: new fields.NumberField({required: true, integer: true, initial: 5, min: 1, max: 10, step: 1})
        })
      }),
      flags: new fields.ObjectField()
    }
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["AMBIENT_SOUND"];
}
