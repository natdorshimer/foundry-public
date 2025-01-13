import BaseEffectSource from "./base-effect-source.mjs";
import PointEffectSourceMixin from "./point-effect-source.mjs";

/**
 * A specialized subclass of the BaseEffectSource which describes a point-based source of sound.
 * @extends {BaseEffectSource}
 * @mixes {PointEffectSource}
 */
export default class PointSoundSource extends PointEffectSourceMixin(BaseEffectSource) {

  /** @override */
  static sourceType = "sound";

  /** @override */
  get effectsCollection() {
    return canvas.sounds.sources;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getPolygonConfiguration() {
    return Object.assign(super._getPolygonConfiguration(), {useThreshold: true});
  }

  /* -------------------------------------------- */

  /**
   * Get the effective volume at which an AmbientSound source should be played for a certain listener.
   * @param {Point} listener
   * @param {object} [options]
   * @param {boolean} [options.easing]
   * @returns {number}
   */
  getVolumeMultiplier(listener, {easing=true}={}) {
    if ( !listener ) return 0;                                        // No listener = 0
    const {x, y, radius} = this.data;
    const distance = Math.hypot(listener.x - x, listener.y - y);
    if ( distance === 0 ) return 1;
    if ( distance > radius ) return 0;                                // Distance outside of radius = 0
    if ( !this.shape?.contains(listener.x, listener.y) ) return 0;    // Point outside of shape = 0
    if ( !easing ) return 1;                                          // No easing = 1
    const dv = Math.clamp(distance, 0, radius) / radius;
    return (Math.cos(Math.PI * dv) + 1) * 0.5;                        // Cosine easing [0, 1]
  }
}
