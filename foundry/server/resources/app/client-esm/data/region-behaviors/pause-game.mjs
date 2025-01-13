import RegionBehaviorType from "./base.mjs";
import {REGION_EVENTS} from "../../../common/constants.mjs";
import * as fields from "../../../common/data/fields.mjs";

/**
 * The data model for a behavior that pauses the game when a player-controlled Token enters the Region.
 *
 * @property {boolean} once    Disable the behavior once a player-controlled Token enters the region?
 */
export default class PauseGameRegionBehaviorType extends RegionBehaviorType {

  /** @override */
  static LOCALIZATION_PREFIXES = ["BEHAVIOR.TYPES.pauseGame", "BEHAVIOR.TYPES.base"];

  /* ---------------------------------------- */

  /** @override */
  static defineSchema() {
    return {
      once: new fields.BooleanField()
    };
  }

  /* ---------------------------------------- */

  /**
   * Pause the game if a player-controlled Token moves into the Region.
   * @param {RegionEvent} event
   * @this {PauseGameRegionBehaviorType}
   */
  static async #onTokenMoveIn(event) {
    if ( event.data.forced || event.user.isGM || !game.users.activeGM?.isSelf ) return;
    game.togglePause(true, true);
    if ( this.once ) {
      // noinspection ES6MissingAwait
      this.parent.update({disabled: true});
    }
  }

  /* ---------------------------------------- */

  /**
   * Stop movement after a player-controlled Token enters the Region.
   * @param {RegionEvent} event
   * @this {PauseGameRegionBehaviorType}
   */
  static async #onTokenPreMove(event) {
    if ( event.user.isGM ) return;
    for ( const segment of event.data.segments ) {
      if ( segment.type === Region.MOVEMENT_SEGMENT_TYPES.ENTER ) {
        event.data.destination = segment.to;
        break;
      }
    }
  }

  /* ---------------------------------------- */

  /** @override */
  static events = {
    [REGION_EVENTS.TOKEN_MOVE_IN]: this.#onTokenMoveIn,
    [REGION_EVENTS.TOKEN_PRE_MOVE]: this.#onTokenPreMove
  };
}

