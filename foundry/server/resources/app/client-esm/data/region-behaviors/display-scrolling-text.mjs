import RegionBehaviorType from "./base.mjs";
import {REGION_EVENTS} from "../../../common/constants.mjs";
import * as fields from "../../../common/data/fields.mjs";

/**
 * The data model for a behavior that displays scrolling text above a token when one of the subscribed events occurs.
 *
 * @property {boolean} once           Disable the behavior after it triggers once
 * @property {string} text            The text to display
 * @property {string} color           Optional color setting for the text
 * @property {number} visibility      Which users the scrolling text will display for
                                      (see {@link DisplayScrollingTextRegionBehaviorType.VISIBILITY_MODES})
 */
export default class DisplayScrollingTextRegionBehaviorType extends RegionBehaviorType {

  /** @override */
  static LOCALIZATION_PREFIXES = ["BEHAVIOR.TYPES.displayScrollingText", "BEHAVIOR.TYPES.base"];

  /* ---------------------------------------- */

  /**
   * Text visibility behavior modes.
   * @enum {number}
   */
  static get VISIBILITY_MODES() {
    return DisplayScrollingTextRegionBehaviorType.#VISIBILITY_MODES;
  }

  static #VISIBILITY_MODES = Object.freeze({
    /**
     * Display only for gamemaster users
     */
    GAMEMASTER: 0,

    /**
     * Display only for users with observer permissions on the triggering token (and for the GM)
     */
    OBSERVER: 1,

    /**
     * Display for all users
     */
    ANYONE: 2,
  });

  /* ---------------------------------------- */

  /** @override */
  static defineSchema() {
    return {
      events: this._createEventsField({events: [
        REGION_EVENTS.TOKEN_ENTER,
        REGION_EVENTS.TOKEN_EXIT,
        REGION_EVENTS.TOKEN_MOVE,
        REGION_EVENTS.TOKEN_MOVE_IN,
        REGION_EVENTS.TOKEN_MOVE_OUT,
        REGION_EVENTS.TOKEN_TURN_START,
        REGION_EVENTS.TOKEN_TURN_END,
        REGION_EVENTS.TOKEN_ROUND_START,
        REGION_EVENTS.TOKEN_ROUND_END
      ]}),
      text: new fields.StringField({required: true}),
      color: new fields.ColorField({required: true, nullable: false, initial: "#ffffff"}),
      visibility: new fields.NumberField({
        required: true,
        choices: Object.entries(this.VISIBILITY_MODES).reduce((obj, [key, value]) => {
          obj[value] = `BEHAVIOR.TYPES.displayScrollingText.VISIBILITY_MODES.${key}.label`;
          return obj;
        }, {}),
        initial: this.VISIBILITY_MODES.ANYONE,
        validationError: "must be a value in DisplayScrollingTextRegionBehaviorType.VISIBILITY_MODES"}),
      once: new fields.BooleanField()
    };
  }

  /* ---------------------------------------- */

  /**
   * Display the scrolling text to the current User?
   * @param {RegionEvent} event    The Region event.
   * @returns {boolean}            Display the scrolling text to the current User?
   */
  #canView(event) {
    if ( !this.parent.scene.isView ) return false;
    if ( game.user.isGM ) return true;
    if ( event.data.token.isSecret ) return false;

    const token = event.data.token.object;
    if ( !token || !token.visible ) return false;

    const M = DisplayScrollingTextRegionBehaviorType.VISIBILITY_MODES;
    if ( this.visibility === M.ANYONE ) return true;
    if ( this.visibility === M.OBSERVER ) return event.data.token.testUserPermission(game.user, "OBSERVER");
    return false;
  }

  /* ---------------------------------------- */

  /** @override */
  async _handleRegionEvent(event) {
    if ( this.once && game.users.activeGM?.isSelf ) {
      // noinspection ES6MissingAwait
      this.parent.update({disabled: true});
    }

    if ( !this.text ) return;
    const canView = this.#canView(event);
    if ( !canView ) return;

    const token = event.data.token.object;
    const animation = CanvasAnimation.getAnimation(token.animationName);
    if ( animation ) await animation.promise;
    await canvas.interface.createScrollingText(
      token.center,
      this.text,
      {
        distance: 2 * token.h,
        fontSize: 28,
        fill: this.color,
        stroke: 0x000000,
        strokeThickness: 4
      }
    );
  }
}
