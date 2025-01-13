import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";
import * as CONST from "../constants.mjs";

/**
 * @typedef {import("./_types.mjs").CombatantData} CombatantData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Combatant Document.
 * Defines the DataSchema and common behaviors for a Combatant which are shared between both client and server.
 * @mixes CombatantData
 */
export default class BaseCombatant extends Document {
  /**
   * Construct a Combatant document using provided data and context.
   * @param {Partial<CombatantData>} data           Initial data from which to construct the Combatant
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
    name: "Combatant",
    collection: "combatants",
    label: "DOCUMENT.Combatant",
    labelPlural: "DOCUMENT.Combatants",
    isEmbedded: true,
    hasTypeData: true,
    permissions: {
      create: this.#canCreate,
      update: this.#canUpdate
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      type: new fields.DocumentTypeField(this, {initial: CONST.BASE_DOCUMENT_TYPE}),
      system: new fields.TypeDataField(this),
      actorId: new fields.ForeignDocumentField(documents.BaseActor, {label: "COMBAT.CombatantActor", idOnly: true}),
      tokenId: new fields.ForeignDocumentField(documents.BaseToken, {label: "COMBAT.CombatantToken", idOnly: true}),
      sceneId: new fields.ForeignDocumentField(documents.BaseScene, {label: "COMBAT.CombatantScene", idOnly: true}),
      name: new fields.StringField({label: "COMBAT.CombatantName", textSearch: true}),
      img: new fields.FilePathField({categories: ["IMAGE"], label: "COMBAT.CombatantImage"}),
      initiative: new fields.NumberField({label: "COMBAT.CombatantInitiative"}),
      hidden: new fields.BooleanField({label: "COMBAT.CombatantHidden"}),
      defeated: new fields.BooleanField({label: "COMBAT.CombatantDefeated"}),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
  }

  /**
   * Is a user able to update an existing Combatant?
   * @private
   */
  static #canUpdate(user, doc, data) {
    if ( user.isGM ) return true; // GM users can do anything
    if ( doc.actor && !doc.actor.canUserModify(user, "update", data) ) return false;
    const updateKeys = new Set(Object.keys(data));
    const allowedKeys = new Set(["_id", "initiative", "flags", "defeated"]);
    return updateKeys.isSubset(allowedKeys); // Players may only update initiative scores, flags, and the defeated state
  }

  /**
   * Is a user able to create this Combatant?
   * @private
   */
  static #canCreate(user, doc, data) {
    if ( user.isGM ) return true;
    if ( doc.actor ) return doc.actor.canUserModify(user, "update", data);
    return true;
  }

  /** @override */
  getUserLevel(user) {
    user = user || game.user;
    const {NONE, OWNER} = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    if ( user.isGM ) return OWNER;
    return this.actor?.getUserLevel(user) ?? NONE;
  }
}
