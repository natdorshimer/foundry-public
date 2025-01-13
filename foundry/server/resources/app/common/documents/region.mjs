import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import * as documents from "./_module.mjs";
import {BaseShapeData} from "../data/data.mjs";
import Color from "../utils/color.mjs";

/**
 * @typedef {import("./_types.mjs").RegionData} RegionData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Region Document.
 * Defines the DataSchema and common behaviors for a Region which are shared between both client and server.
 * @mixes RegionData
 */
export default class BaseRegion extends Document {
  /**
   * Construct a Region document using provided data and context.
   * @param {Partial<RegionData>} data         Initial data from which to construct the Region
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
    name: "Region",
    collection: "regions",
    label: "DOCUMENT.Region",
    labelPlural: "DOCUMENT.Regions",
    isEmbedded: true,
    embedded: {
      RegionBehavior: "behaviors"
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, label: "Name", textSearch: true}),
      color: new fields.ColorField({required: true, nullable: false,
        initial: () => Color.fromHSV([Math.random(), 0.8, 0.8]).css,
        label: "REGION.FIELDS.color.label",
        hint: "REGION.FIELDS.color.hint"}),
      shapes: new fields.ArrayField(new fields.TypedSchemaField(BaseShapeData.TYPES),
        {label: "REGION.FIELDS.shapes.label", hint: "REGION.FIELDS.shapes.hint"}),
      elevation: new fields.SchemaField({
        bottom: new fields.NumberField({required: true,
          label: "REGION.FIELDS.elevation.FIELDS.bottom.label",
          hint: "REGION.FIELDS.elevation.FIELDS.bottom.hint"}), // null -> -Infinity
        top: new fields.NumberField({required: true,
          label: "REGION.FIELDS.elevation.FIELDS.top.label",
          hint: "REGION.FIELDS.elevation.FIELDS.top.hint"}) // null -> +Infinity
      }, {
        label: "REGION.FIELDS.elevation.label",
        hint: "REGION.FIELDS.elevation.hint",
        validate: d => (d.bottom ?? -Infinity) <= (d.top ?? Infinity),
        validationError: "elevation.top may not be less than elevation.bottom"
      }),
      behaviors: new fields.EmbeddedCollectionField(documents.BaseRegionBehavior, {label: "REGION.FIELDS.behaviors.label",
        hint: "REGION.FIELDS.behaviors.hint"}),
      visibility: new fields.NumberField({required: true,
        initial: CONST.REGION_VISIBILITY.LAYER,
        choices:  Object.fromEntries(Object.entries(CONST.REGION_VISIBILITY).map(([key, value]) =>
          [value, {label: `REGION.VISIBILITY.${key}.label`}])),
        label: "REGION.FIELDS.visibility.label",
        hint: "REGION.FIELDS.visibility.hint"}),
      locked: new fields.BooleanField(),
      flags: new fields.ObjectField()
    }
  };
}
