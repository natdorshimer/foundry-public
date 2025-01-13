import TypeDataModel from "../../../common/abstract/type-data.mjs";
import * as fields from "../../../common/data/fields.mjs";

/**
 * The data model for a behavior that receives Region events.
 * @extends TypeDataModel
 * @memberof data.behaviors
 * @abstract
 *
 * @property {Set<string>} events    The Region events that are handled by the behavior.
 */
export default class RegionBehaviorType extends TypeDataModel {

  /**
   * Create the events field.
   * @param {object} options      Options which configure how the events field is declared
   * @param {string[]} [options.events]     The event names to restrict to.
   * @param {string[]} [options.initial]    The initial set of events that should be default for the field
   * @returns {fields.SetField}
   * @protected
   */
  static _createEventsField({events, initial}={}) {
    const setFieldOptions = {
      label: "BEHAVIOR.TYPES.base.FIELDS.events.label",
      hint: "BEHAVIOR.TYPES.base.FIELDS.events.hint"
    };
    if ( initial ) setFieldOptions.initial = initial;
    return new fields.SetField(new fields.StringField({
      required: true,
      choices: Object.values(CONST.REGION_EVENTS).reduce((obj, e) => {
        if ( events && !events.includes(e) ) return obj;
        obj[e] = `REGION.EVENTS.${e}.label`;
        return obj;
      }, {})
    }), setFieldOptions);
  }

  /* ---------------------------------------- */

  /**
   * @callback EventBehaviorStaticHandler  Run in the context of a {@link RegionBehaviorType}.
   * @param {RegionEvent} event
   * @returns {Promise<void>}
   */

  /**
   * A RegionBehaviorType may register to always receive certain events by providing a record of handler functions.
   * These handlers are called with the behavior instance as its bound scope.
   * @type {Record<string, EventBehaviorStaticHandler>}
   */
  static events = {};

  /* ---------------------------------------- */

  /**
   * The events that are handled by the behavior.
   * @type {Set<string>}
   */
  events = this.events ?? new Set();

  /* ---------------------------------------- */

  /**
   * A convenience reference to the RegionBehavior which contains this behavior sub-type.
   * @type {RegionBehavior|null}
   */
  get behavior() {
    return this.parent;
  }

  /* ---------------------------------------- */

  /**
   * A convenience reference to the RegionDocument which contains this behavior sub-type.
   * @type {RegionDocument|null}
   */
  get region() {
    return this.behavior?.region ?? null;
  }

  /* ---------------------------------------- */

  /**
   * A convenience reference to the Scene which contains this behavior sub-type.
   * @type {Scene|null}
   */
  get scene() {
    return this.behavior?.scene ?? null;
  }

  /* ---------------------------------------- */

  /**
   * Handle the Region event.
   * @param {RegionEvent} event    The Region event
   * @returns {Promise<void>}
   * @protected
   * @internal
   */
  async _handleRegionEvent(event) {}
}
