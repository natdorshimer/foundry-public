import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";
import * as CONST from "../constants.mjs";

/**
 * @typedef {import("./_types.mjs").CardData} CardData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Card Document.
 * Defines the DataSchema and common behaviors for a Card which are shared between both client and server.
 * @mixes CardData
 */
export default class BaseCard extends Document {
  /**
   * Construct a Card document using provided data and context.
   * @param {Partial<CardData>} data                Initial data from which to construct the Card
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
    name: "Card",
    collection: "cards",
    hasTypeData: true,
    indexed: true,
    label: "DOCUMENT.Card",
    labelPlural: "DOCUMENT.Cards",
    permissions: {
      create: this.#canCreate,
      update: this.#canUpdate
    },
    compendiumIndexFields: ["name", "type", "suit", "sort"],
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, label: "CARD.Name", textSearch: true}),
      description: new fields.HTMLField({label: "CARD.Description"}),
      type: new fields.DocumentTypeField(this, {initial: CONST.BASE_DOCUMENT_TYPE}),
      system: new fields.TypeDataField(this),
      suit: new fields.StringField({label: "CARD.Suit"}),
      value: new fields.NumberField({label: "CARD.Value"}),
      back: new fields.SchemaField({
        name: new fields.StringField({label: "CARD.BackName"}),
        text: new fields.HTMLField({label: "CARD.BackText"}),
        img: new fields.FilePathField({categories: ["IMAGE", "VIDEO"], label: "CARD.BackImage"}),
      }),
      faces: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({label: "CARD.FaceName"}),
        text: new fields.HTMLField({label: "CARD.FaceText"}),
        img: new fields.FilePathField({categories: ["IMAGE", "VIDEO"], initial: () => this.DEFAULT_ICON,
          label: "CARD.FaceImage"}),
      })),
      face: new fields.NumberField({required: true, initial: null, integer: true, min: 0, label: "CARD.Face"}),
      drawn: new fields.BooleanField({label: "CARD.Drawn"}),
      origin: new fields.ForeignDocumentField(documents.BaseCards),
      width: new fields.NumberField({integer: true, positive: true, label: "Width"}),
      height: new fields.NumberField({integer: true, positive: true, label: "Height"}),
      rotation: new fields.AngleField({label: "Rotation"}),
      sort: new fields.IntegerSortField(),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
  }

  /**
   * The default icon used for a Card face that does not have a custom image set
   * @type {string}
   */
  static DEFAULT_ICON = "icons/svg/card-joker.svg";

  /**
   * Is a User able to create a new Card within this parent?
   * @private
   */
  static #canCreate(user, doc, data) {
    if ( user.isGM ) return true;                             // GM users can always create
    if ( doc.parent.type !== "deck" ) return true;            // Users can pass cards to card hands or piles
    return doc.parent.canUserModify(user, "create", data);    // Otherwise require parent document permission
  }

  /**
   * Is a user able to update an existing Card?
   * @private
   */
  static #canUpdate(user, doc, data) {
    if ( user.isGM ) return true;                               // GM users can always update
    const wasDrawn = new Set(["drawn", "_id"]);                 // Users can draw cards from a deck
    if ( new Set(Object.keys(data)).equals(wasDrawn) ) return true;
    return doc.parent.canUserModify(user, "update", data);      // Otherwise require parent document permission
  }

  /* -------------------------------------------- */
  /*  Model Methods                               */
  /* -------------------------------------------- */

  /** @inheritdoc */
  testUserPermission(user, permission, {exact=false}={}) {
    if ( this.isEmbedded ) return this.parent.testUserPermission(user, permission, {exact});
    return super.testUserPermission(user, permission, {exact});
  }
}
