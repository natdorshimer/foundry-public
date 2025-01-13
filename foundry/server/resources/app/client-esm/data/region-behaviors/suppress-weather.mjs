import RegionBehaviorType from "./base.mjs";
import RegionMesh from "../../canvas/regions/mesh.mjs";
import {REGION_EVENTS} from "../../../common/constants.mjs";

/**
 * The data model for a behavior that allows to suppress weather effects within the Region
 */
export default class SuppressWeatherRegionBehaviorType extends RegionBehaviorType {

  /** @override */
  static LOCALIZATION_PREFIXES = ["BEHAVIOR.TYPES.suppressWeather", "BEHAVIOR.TYPES.base"];

  /* ---------------------------------------- */

  /** @override */
  static defineSchema() {
    return {};
  }

  /* ---------------------------------------- */

  /**
   * Called when the status of the weather behavior is changed.
   * @param {RegionEvent} event
   * @this {SuppressWeatherRegionBehaviorType}
   */
  static async #onBehaviorStatus(event) {

    // Create mesh
    if ( event.data.viewed === true ) {
      const mesh = new RegionMesh(this.region.object);
      mesh.name = this.behavior.uuid;
      mesh.blendMode = PIXI.BLEND_MODES.ERASE;
      canvas.weather.suppression.addChild(mesh);
    }

    // Destroy mesh
    else if ( event.data.viewed === false ) {
      const mesh = canvas.weather.suppression.getChildByName(this.behavior.uuid);
      mesh.destroy();
    }
  }

  /* ---------------------------------------- */

  /** @override */
  static events = {
    [REGION_EVENTS.BEHAVIOR_STATUS]: this.#onBehaviorStatus
  };
}
