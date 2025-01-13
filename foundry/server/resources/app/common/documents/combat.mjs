import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import * as documents from "./_module.mjs";
import * as CONST from "../constants.mjs";
import {isValidId} from "../data/validators.mjs";

/**
 * @typedef {import("./_types.mjs").CombatData} CombatData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Card Document.
 * Defines the DataSchema and common behaviors for a Combat which are shared between both client and server.
 * @mixes CombatData
 */
export default class BaseCombat extends Document {
  /**
   * Construct a Combat document using provided data and context.
   * @param {Partial<CombatData>} data              Initial data from which to construct the Combat
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
    name: "Combat",
    collection: "combats",
    label: "DOCUMENT.Combat",
    labelPlural: "DOCUMENT.Combats",
    embedded: {
      Combatant: "combatants"
    },
    hasTypeData: true,
    permissions: {
      update: this.#canUpdate
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /* -------------------------------------------- */

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      type: new fields.DocumentTypeField(this, {initial: CONST.BASE_DOCUMENT_TYPE}),
      system: new fields.TypeDataField(this),
      scene: new fields.ForeignDocumentField(documents.BaseScene),
      combatants: new fields.EmbeddedCollectionField(documents.BaseCombatant),
      active: new fields.BooleanField(),
      round: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 0,
        label: "COMBAT.Round"}),
      turn: new fields.NumberField({required: true, integer: true, min: 0, initial: null, label: "COMBAT.Turn"}),
      sort: new fields.IntegerSortField(),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
  }

  /* -------------------------------------------- */

  /**
   * Is a user able to update an existing Combat?
   * @protected
   */
  static #canUpdate(user, doc, data) {
    if ( user.isGM ) return true;                             // GM users can do anything
    const turnOnly = ["_id", "round", "turn", "combatants"];  // Players may only modify a subset of fields
    if ( Object.keys(data).some(k => !turnOnly.includes(k)) ) return false;
    if ( ("round" in data) && !doc._canChangeRound(user) ) return false;
    if ( ("turn" in data) && !doc._canChangeTurn(user) ) return false;
    if ( ("combatants" in data) && !doc.#canModifyCombatants(user, data.combatants) ) return false;
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Can a certain User change the Combat round?
   * @param {User} user     The user attempting to change the round
   * @returns {boolean}     Is the user allowed to change the round?
   * @protected
   */
  _canChangeRound(user) {
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Can a certain User change the Combat turn?
   * @param {User} user     The user attempting to change the turn
   * @returns {boolean}     Is the user allowed to change the turn?
   * @protected
   */
  _canChangeTurn(user) {
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Can a certain user make modifications to the array of Combatants?
   * @param {User} user     The user attempting to modify combatants
   * @param {Partial<CombatantData>[]} combatants   Proposed combatant changes
   * @returns {boolean}     Is the user allowed to make this change?
   */
  #canModifyCombatants(user, combatants) {
    for ( const {_id, ...change} of combatants ) {
      const c = this.combatants.get(_id);
      if ( !c ) return false;
      if ( !c.canUserModify(user, "update", change) ) return false;
    }
    return true;
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if ( allowed === false ) return false;
    // Don't allow linking to a Scene that doesn't contain all its Combatants
    if ( !("scene" in changed) ) return;
    const sceneId = this.schema.fields.scene.clean(changed.scene);
    if ( (sceneId !== null) && isValidId(sceneId)
      && this.combatants.some(c => c.sceneId && (c.sceneId !== sceneId)) ) {
      throw new Error("You cannot link the Combat to a Scene that doesn't contain all its Combatants.");
    }
  }
}
