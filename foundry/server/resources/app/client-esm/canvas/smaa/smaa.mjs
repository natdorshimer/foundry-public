
import {default as SMAAEdgeDetectionFilter} from "./edges.mjs";
import {default as SMAABlendingWeightCalculationFilter} from "./weights.mjs";
import {default as SMAANeighborhoodBlendingFilter} from "./blend.mjs";

/**
 * @typedef {object} SMAAFilterConfig
 * @property {number} threshold                    Specifies the threshold or sensitivity to edges. Lowering this value you will be able to detect more edges at the expense of performance. Range: [0, 0.5]. 0.1 is a reasonable value, and allows to catch most visible edges. 0.05 is a rather overkill value, that allows to catch 'em all.
 * @property {number} localContrastAdaptionFactor  If there is an neighbor edge that has SMAA_LOCAL_CONTRAST_FACTOR times bigger contrast than current edge, current edge will be discarded.
 *                                                 This allows to eliminate spurious crossing edges, and is based on the fact that, if there is too much contrast in a direction, that will hide perceptually contrast in the other neighbors.
 * @property {number} maxSearchSteps               Specifies the maximum steps performed in the horizontal/vertical pattern searches, at each side of the pixel. In number of pixels, it's actually the double. So the maximum line length perfectly handled by, for example 16, is 64 (by perfectly, we meant that longer lines won't look as good, but still antialiased. Range: [0, 112].
 * @property {number} maxSearchStepsDiag           Specifies the maximum steps performed in the diagonal pattern searches, at each side of the pixel. In this case we jump one pixel at time, instead of two. Range: [0, 20].
 * @property {number} cornerRounding               Specifies how much sharp corners will be rounded. Range: [0, 100].
 * @property {boolean} disableDiagDetection        Is diagonal detection disabled?
 * @property {boolean} disableCornerDetection      Is corner detection disabled?
 */

export default class SMAAFilter extends PIXI.Filter {
  /**
   * @param {Partial<SMAAFilterConfig>} [config]    The config (defaults: {@link SMAAFilter.PRESETS.DEFAULT})
   */
  constructor({threshold=0.1, localContrastAdaptionFactor=2.0, maxSearchSteps=16, maxSearchStepsDiag=8, cornerRounding=25, disableDiagDetection=false, disableCornerDetection=false}={}) {
    super();
    const config = {threshold, localContrastAdaptionFactor, maxSearchSteps, maxSearchStepsDiag, cornerRounding, disableDiagDetection, disableCornerDetection};
    this.#edgesFilter = new SMAAEdgeDetectionFilter(config);
    this.#weightsFilter = new SMAABlendingWeightCalculationFilter(config);
    this.#blendFilter = new SMAANeighborhoodBlendingFilter();
  }

  /* -------------------------------------------- */

  /**
   * The presets.
   * @enum {SMAAFilterConfig}
   */
  static get PRESETS() {
    return SMAAFilter.#PRESETS;
  }

  static #PRESETS = {
    LOW: {
      threshold: 0.15,
      localContrastAdaptionFactor: 2.0,
      maxSearchSteps: 4,
      maxSearchStepsDiag: 0,
      cornerRounding: 0,
      disableDiagDetection: true,
      disableCornerDetection: true
    },
    MEDIUM: {
      threshold: 0.1,
      localContrastAdaptionFactor: 2.0,
      maxSearchSteps: 8,
      maxSearchStepsDiag: 0,
      cornerRounding: 0,
      disableDiagDetection: true,
      disableCornerDetection: true
    },
    HIGH: {
      threshold: 0.1,
      localContrastAdaptionFactor: 2.0,
      maxSearchSteps: 16,
      maxSearchStepsDiag: 8,
      cornerRounding: 25,
      disableDiagDetection: false,
      disableCornerDetection: false
    },
    ULTRA: {
      threshold: 0.05,
      localContrastAdaptionFactor: 2.0,
      maxSearchSteps: 32,
      maxSearchStepsDiag: 16,
      cornerRounding: 25,
      disableDiagDetection: false,
      disableCornerDetection: false
    }
  };

  /* -------------------------------------------- */

  /**
   * The edge detection filter.
   * @type {SMAAEdgeDetectionFilter}
   */
  #edgesFilter;

  /* -------------------------------------------- */

  /**
   * The blending weight calculation filter.
   * @type {SMAABlendingWeightCalculationFilter}
   */
  #weightsFilter;

  /* -------------------------------------------- */

  /**
   * The neighborhood blending filter.
   * @type {SMAANeighborhoodBlendingFilter}
   */
  #blendFilter;

  /* -------------------------------------------- */

  /** @override */
  apply(filterManager, input, output, clearMode, currentState) {
    const edgesTex = filterManager.getFilterTexture();
    const blendTex = filterManager.getFilterTexture();
    this.#edgesFilter.apply(filterManager, input, edgesTex, PIXI.CLEAR_MODES.CLEAR, currentState);
    this.#weightsFilter.apply(filterManager, edgesTex, blendTex, PIXI.CLEAR_MODES.CLEAR, currentState);
    this.#blendFilter.uniforms.blendTex = blendTex;
    this.#blendFilter.apply(filterManager, input, output, clearMode, currentState);
    filterManager.returnFilterTexture(edgesTex);
    filterManager.returnFilterTexture(blendTex);
  }
}
