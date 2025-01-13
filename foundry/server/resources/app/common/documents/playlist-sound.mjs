import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import * as CONST from "../constants.mjs";

/**
 * @typedef {import("./_types.mjs").PlaylistSoundData} PlaylistSoundData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The PlaylistSound Document.
 * Defines the DataSchema and common behaviors for a PlaylistSound which are shared between both client and server.
 * @mixes PlaylistSoundData
 */
export default class BasePlaylistSound extends Document {
  /**
   * Construct a PlaylistSound document using provided data and context.
   * @param {Partial<PlaylistSoundData>} data       Initial data from which to construct the PlaylistSound
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
    name: "PlaylistSound",
    collection: "sounds",
    indexed: true,
    label: "DOCUMENT.PlaylistSound",
    labelPlural: "DOCUMENT.PlaylistSounds",
    compendiumIndexFields: ["name", "sort"],
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, textSearch: true}),
      description: new fields.StringField(),
      path: new fields.FilePathField({categories: ["AUDIO"]}),
      channel: new fields.StringField({choices: CONST.AUDIO_CHANNELS, initial: "music", blank: true}),
      playing: new fields.BooleanField(),
      pausedTime: new fields.NumberField({min: 0}),
      repeat: new fields.BooleanField(),
      volume: new fields.AlphaField({initial: 0.5, step: 0.01}),
      fade: new fields.NumberField({integer: true, min: 0}),
      sort: new fields.IntegerSortField(),
      flags: new fields.ObjectField(),
    }
  }

  /* -------------------------------------------- */
  /*  Model Methods                               */
  /* -------------------------------------------- */

  /** @inheritdoc */
  testUserPermission(user, permission, {exact = false} = {}) {
    if ( this.isEmbedded ) return this.parent.testUserPermission(user, permission, {exact});
    return super.testUserPermission(user, permission, {exact});
  }
}
