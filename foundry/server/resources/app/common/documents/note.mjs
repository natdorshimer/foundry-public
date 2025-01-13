import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import * as documents from "./_module.mjs";
import * as CONST from "../constants.mjs";
import {TextureData} from "../data/data.mjs";

/**
 * @typedef {import("./_types.mjs").NoteData} NoteData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Note Document.
 * Defines the DataSchema and common behaviors for a Note which are shared between both client and server.
 * @mixes NoteData
 */
export default class BaseNote extends Document {
  /**
   * Construct a Note document using provided data and context.
   * @param {Partial<NoteData>} data                Initial data from which to construct the Note
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
    name: "Note",
    collection: "notes",
    label: "DOCUMENT.Note",
    labelPlural: "DOCUMENT.Notes",
    permissions: {
      create: "NOTE_CREATE"
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      entryId: new fields.ForeignDocumentField(documents.BaseJournalEntry, {idOnly: true}),
      pageId: new fields.ForeignDocumentField(documents.BaseJournalEntryPage, {idOnly: true}),
      x: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0, label: "XCoord"}),
      y: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0, label: "YCoord"}),
      elevation: new fields.NumberField({required: true, nullable: false, initial: 0}),
      sort: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0}),
      texture: new TextureData({}, {categories: ["IMAGE"],
        initial: {src: () => this.DEFAULT_ICON, anchorX: 0.5, anchorY: 0.5, fit: "contain"}, label: "NOTE.EntryIcon"}),
      iconSize: new fields.NumberField({required: true, nullable: false, integer: true, min: 32, initial: 40,
        validationError: "must be an integer greater than 32", label: "NOTE.IconSize"}),
      text: new fields.StringField({label: "NOTE.TextLabel", textSearch: true}),
      fontFamily: new fields.StringField({required: true, label: "NOTE.FontFamily",
        initial: () => globalThis.CONFIG?.defaultFontFamily || "Signika"}),
      fontSize: new fields.NumberField({required: true, integer: true, min: 8, max: 128, initial: 32,
        validationError: "must be an integer between 8 and 128", label: "NOTE.FontSize"}),
      textAnchor: new fields.NumberField({required: true, choices: Object.values(CONST.TEXT_ANCHOR_POINTS),
        initial: CONST.TEXT_ANCHOR_POINTS.BOTTOM, label: "NOTE.AnchorPoint",
        validationError: "must be a value in CONST.TEXT_ANCHOR_POINTS"}),
      textColor: new fields.ColorField({required: true, nullable: false, initial: "#ffffff", label: "NOTE.TextColor"}),
      global: new fields.BooleanField(),
      flags: new fields.ObjectField()
    }
  }

  /**
   * The default icon used for newly created Note documents.
   * @type {string}
   */
  static DEFAULT_ICON = "icons/svg/book.svg";

  /* -------------------------------------------- */
  /*  Model Methods                               */
  /* -------------------------------------------- */

  /** @inheritdoc */
  testUserPermission(user, permission, {exact=false}={}) {
    if ( user.isGM ) return true;                             // Game-masters always have control
    // Players can create and edit unlinked notes with the appropriate permission.
    if ( !this.entryId ) return user.hasPermission("NOTE_CREATE");
    if ( !this.entry ) return false;                          // Otherwise, permission comes through the JournalEntry
    return this.entry.testUserPermission(user, permission, {exact});
  }
}
