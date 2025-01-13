/**
 * Abstract shader used for Adjust Darkness Level region behavior.
 * @abstract
 * @internal
 * @ignore
 */
class AbstractDarknessLevelRegionShader extends RegionShader {

  /** @inheritDoc */
  static defaultUniforms = {
    ...super.defaultUniforms,
    bottom: 0,
    top: 0,
    depthTexture: null
  };

  /* ---------------------------------------- */

  /**
   * The darkness level adjustment mode.
   * @type {number}
   */
  mode = foundry.data.regionBehaviors.AdjustDarknessLevelRegionBehaviorType.MODES.OVERRIDE;

  /* ---------------------------------------- */

  /**
   * The darkness level modifier.
   * @type {number}
   */
  modifier = 0;

  /* ---------------------------------------- */

  /**
   * Current darkness level of this mesh.
   * @type {number}
   */
  get darknessLevel() {
    const M = foundry.data.regionBehaviors.AdjustDarknessLevelRegionBehaviorType.MODES;
    switch ( this.mode ) {
      case M.OVERRIDE: return this.modifier;
      case M.BRIGHTEN: return canvas.environment.darknessLevel * (1 - this.modifier);
      case M.DARKEN: return 1 - ((1 - canvas.environment.darknessLevel) * (1 - this.modifier));
      default: throw new Error("Invalid mode");
    }
  }

  /* ---------------------------------------- */

  /** @inheritDoc */
  _preRender(mesh, renderer) {
    super._preRender(mesh, renderer);
    const u = this.uniforms;
    u.bottom = canvas.masks.depth.mapElevation(mesh.region.bottom);
    u.top = canvas.masks.depth.mapElevation(mesh.region.top);
    if ( !u.depthTexture ) u.depthTexture = canvas.masks.depth.renderTexture;
  }
}

/* ---------------------------------------- */

/**
 * Render the RegionMesh with darkness level adjustments.
 * @internal
 * @ignore
 */
class AdjustDarknessLevelRegionShader extends AbstractDarknessLevelRegionShader {

  /** @override */
  static fragmentShader = `
    precision ${PIXI.settings.PRECISION_FRAGMENT} float;

    uniform sampler2D depthTexture;
    uniform float darknessLevel;
    uniform float top;
    uniform float bottom;
    uniform vec4 tintAlpha;
    varying vec2 vScreenCoord;

    void main() {
      vec2 depthColor = texture2D(depthTexture, vScreenCoord).rg;
      float depth = step(depthColor.g, top) * step(bottom, (254.5 / 255.0) - depthColor.r);
      gl_FragColor = vec4(darknessLevel, 0.0, 0.0, 1.0) * tintAlpha * depth;
    }
  `;

  /* ---------------------------------------- */

  /** @inheritDoc */
  static defaultUniforms = {
    ...super.defaultUniforms,
    darknessLevel: 0
  };

  /* ---------------------------------------- */

  /** @inheritDoc */
  _preRender(mesh, renderer) {
    super._preRender(mesh, renderer);
    this.uniforms.darknessLevel = this.darknessLevel;
  }
}

/* ---------------------------------------- */

/**
 * Render the RegionMesh with darkness level adjustments.
 * @internal
 * @ignore
 */
class IlluminationDarknessLevelRegionShader extends AbstractDarknessLevelRegionShader {

  /** @override */
  static fragmentShader = `
    precision ${PIXI.settings.PRECISION_FRAGMENT} float;

    uniform sampler2D depthTexture;
    uniform float top;
    uniform float bottom;
    uniform vec4 tintAlpha;
    varying vec2 vScreenCoord;

    void main() {
      vec2 depthColor = texture2D(depthTexture, vScreenCoord).rg;
      float depth = step(depthColor.g, top) * step(bottom, (254.5 / 255.0) - depthColor.r);
      gl_FragColor = vec4(1.0) * tintAlpha * depth;
    }
  `;
}
