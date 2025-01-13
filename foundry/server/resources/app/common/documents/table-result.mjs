import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as CONST from "../constants.mjs";
import * as fields from "../data/fields.mjs";

/**
 * @typedef {import("./_types.mjs").TableResultData} TableResultData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The TableResult Document.
 * Defines the DataSchema and common behaviors for a TableResult which are shared between both client and server.
 * @mixes TableResultData
 */
export default class BaseTableResult extends Document {
  /**
   * Construct a TableResult document using provided data and context.
   * @param {Partial<TableResultData>} data         Initial data from which to construct the TableResult
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
    name: "TableResult",
    collection: "results",
    label: "DOCUMENT.TableResult",
    labelPlural: "DOCUMENT.TableResults",
    coreTypes: Object.values(CONST.TABLE_RESULT_TYPES),
    permissions: {
      update: this.#canUpdate
    },
    compendiumIndexFields: ["type"],
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      type: new fields.DocumentTypeField(this, {initial: CONST.TABLE_RESULT_TYPES.TEXT}),
      text: new fields.HTMLField({textSearch: true}),
      img: new fields.FilePathField({categories: ["IMAGE"]}),
      documentCollection: new fields.StringField(),
      documentId: new fields.ForeignDocumentField(Document, {idOnly: true}),
      weight: new fields.NumberField({required: true, integer: true, positive: true, nullable: false, initial: 1}),
      range: new fields.ArrayField(new fields.NumberField({integer: true}), {
        validate: r => (r.length === 2) && (r[1] >= r[0]),
        validationError: "must be a length-2 array of ascending integers"
      }),
      drawn: new fields.BooleanField(),
      flags: new fields.ObjectField()
    }
  }

  /**
   * Is a user able to update an existing TableResult?
   * @private
   */
  static #canUpdate(user, doc, data) {
    if ( user.isGM ) return true;                               // GM users can do anything
    const wasDrawn = new Set(["drawn", "_id"]);                 // Users can update the drawn status of a result
    if ( new Set(Object.keys(data)).equals(wasDrawn) ) return true;
    return doc.parent.canUserModify(user, "update", data);      // Otherwise, go by parent document permission
  }

  /* -------------------------------------------- */
  /*  Model Methods                               */
  /* -------------------------------------------- */

  /** @inheritdoc */
  testUserPermission(user, permission, {exact=false}={}) {
    if ( this.isEmbedded ) return this.parent.testUserPermission(user, permission, {exact});
    return super.testUserPermission(user, permission, {exact});
  }

  /* ---------------------------------------- */
  /*  Deprecations and Compatibility          */
  /* ---------------------------------------- */

  /** @inheritdoc */
  static migrateData(data) {

    /**
     * V12 migration of type from number to string.
     * @deprecated since v12
     */
    if ( typeof data.type === "number" ) {
      switch ( data.type ) {
        case 0: data.type = CONST.TABLE_RESULT_TYPES.TEXT; break;
        case 1: data.type = CONST.TABLE_RESULT_TYPES.DOCUMENT; break;
        case 2: data.type = CONST.TABLE_RESULT_TYPES.COMPENDIUM; break;
      }
    }
    return super.migrateData(data);
  }
}
