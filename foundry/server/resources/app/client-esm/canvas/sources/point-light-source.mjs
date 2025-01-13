import BaseLightSource from "./base-light-source.mjs";
import PointEffectSourceMixin from "./point-effect-source.mjs";

/**
 * A specialized subclass of the BaseLightSource which renders a source of light as a point-based effect.
 * @extends {BaseLightSource}
 * @mixes {PointEffectSourceMixin}
 */
export default class PointLightSource extends PointEffectSourceMixin(BaseLightSource) {

  /** @override */
  static effectsCollection = "lightSources";

  /* -------------------------------------------- */
  /*  Source Suppression Management               */
  /* -------------------------------------------- */

  /**
   * Update darkness suppression according to darkness sources collection.
   */
  #updateDarknessSuppression() {
    this.suppression.darkness = canvas.effects.testInsideDarkness({x: this.x, y: this.y}, this.elevation);
  }

  /* -------------------------------------------- */
  /*  Light Source Initialization                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _initialize(data) {
    super._initialize(data);
    Object.assign(this.data, {
      radius: Math.max(this.data.dim ?? 0, this.data.bright ?? 0)
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _createShapes() {
    this.#updateDarknessSuppression();
    super._createShapes();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _configure(changes) {
    this.ratio = Math.clamp(Math.abs(this.data.bright) / this.data.radius, 0, 1);
    super._configure(changes);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getPolygonConfiguration() {
    return Object.assign(super._getPolygonConfiguration(), {useThreshold: true, includeDarkness: true});
  }

  /* -------------------------------------------- */
  /*  Visibility Testing                          */
  /* -------------------------------------------- */

  /**
   * Test whether this LightSource provides visibility to see a certain target object.
   * @param {object} config               The visibility test configuration
   * @param {CanvasVisibilityTest[]} config.tests  The sequence of tests to perform
   * @param {PlaceableObject} config.object        The target object being tested
   * @returns {boolean}                   Is the target object visible to this source?
   */
  testVisibility({tests, object}={}) {
    if ( !(this.data.vision && this._canDetectObject(object)) ) return false;
    return tests.some(test => this.shape.contains(test.point.x, test.point.y));
  }

  /* -------------------------------------------- */

  /**
   * Can this LightSource theoretically detect a certain object based on its properties?
   * This check should not consider the relative positions of either object, only their state.
   * @param {PlaceableObject} target      The target object being tested
   * @returns {boolean}                   Can the target object theoretically be detected by this vision source?
   */
  _canDetectObject(target) {
    const tgt = target?.document;
    const isInvisible = ((tgt instanceof TokenDocument) && tgt.hasStatusEffect(CONFIG.specialStatusEffects.INVISIBLE));
    return !isInvisible;
  }
}
