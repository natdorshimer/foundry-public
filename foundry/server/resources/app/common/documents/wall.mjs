import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as CONST from "../constants.mjs";
import * as fields from "../data/fields.mjs";

/**
 * @typedef {import("./_types.mjs").WallData} WallData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Wall Document.
 * Defines the DataSchema and common behaviors for a Wall which are shared between both client and server.
 * @mixes WallData
 */
export default class BaseWall extends Document {
  /**
   * Construct a Wall document using provided data and context.
   * @param {Partial<WallData>} data                Initial data from which to construct the Wall
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
    name: "Wall",
    collection: "walls",
    label: "DOCUMENT.Wall",
    labelPlural: "DOCUMENT.Walls",
    permissions: {
      update: this.#canUpdate
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      c: new fields.ArrayField(new fields.NumberField({required: true, integer: true, nullable: false}), {
        validate: c => (c.length === 4),
        validationError: "must be a length-4 array of integer coordinates"}),
      light: new fields.NumberField({required: true, choices: Object.values(CONST.WALL_SENSE_TYPES),
        initial: CONST.WALL_SENSE_TYPES.NORMAL,
        validationError: "must be a value in CONST.WALL_SENSE_TYPES"}),
      move: new fields.NumberField({required: true, choices: Object.values(CONST.WALL_MOVEMENT_TYPES),
        initial: CONST.WALL_MOVEMENT_TYPES.NORMAL,
        validationError: "must be a value in CONST.WALL_MOVEMENT_TYPES"}),
      sight: new fields.NumberField({required: true, choices: Object.values(CONST.WALL_SENSE_TYPES),
        initial: CONST.WALL_SENSE_TYPES.NORMAL,
        validationError: "must be a value in CONST.WALL_SENSE_TYPES"}),
      sound: new fields.NumberField({required: true, choices: Object.values(CONST.WALL_SENSE_TYPES),
        initial: CONST.WALL_SENSE_TYPES.NORMAL,
        validationError: "must be a value in CONST.WALL_SENSE_TYPES"}),
      dir: new fields.NumberField({required: true, choices: Object.values(CONST.WALL_DIRECTIONS),
        initial: CONST.WALL_DIRECTIONS.BOTH,
        validationError: "must be a value in CONST.WALL_DIRECTIONS"}),
      door: new fields.NumberField({required: true, choices: Object.values(CONST.WALL_DOOR_TYPES),
        initial: CONST.WALL_DOOR_TYPES.NONE,
        validationError: "must be a value in CONST.WALL_DOOR_TYPES"}),
      ds: new fields.NumberField({required: true, choices: Object.values(CONST.WALL_DOOR_STATES),
        initial: CONST.WALL_DOOR_STATES.CLOSED,
        validationError: "must be a value in CONST.WALL_DOOR_STATES"}),
      doorSound: new fields.StringField({required: false, blank: true, initial: undefined}),
      threshold: new fields.SchemaField({
        light: new fields.NumberField({required: true, nullable: true, initial: null, positive: true}),
        sight: new fields.NumberField({required: true, nullable: true, initial: null, positive: true}),
        sound: new fields.NumberField({required: true, nullable: true, initial: null, positive: true}),
        attenuation: new fields.BooleanField()
      }),
      flags: new fields.ObjectField()
    };
  }

  /**
   * Is a user able to update an existing Wall?
   * @private
   */
  static #canUpdate(user, doc, data) {
    if ( user.isGM ) return true;                     // GM users can do anything
    const dsOnly = Object.keys(data).every(k => ["_id", "ds"].includes(k));
    if ( dsOnly && (doc.ds !== CONST.WALL_DOOR_STATES.LOCKED) && (data.ds !== CONST.WALL_DOOR_STATES.LOCKED) ) {
      return user.hasRole("PLAYER");                  // Players may open and close unlocked doors
    }
    return false;
  }
}
