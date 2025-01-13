/**
 * Allow coloring of illumination
 */
class TorchIlluminationShader extends AdaptiveIlluminationShader {
  static fragmentShader = `
  ${this.SHADER_HEADER}
  ${this.PERCEIVED_BRIGHTNESS}

  void main() {
    ${this.FRAGMENT_BEGIN}
    ${this.TRANSITION}
    ${this.ADJUSTMENTS}
    ${this.FALLOFF}
    ${this.FRAGMENT_END}
  }`;
}

/* -------------------------------------------- */

/**
 * Torch animation coloration shader
 */
class TorchColorationShader extends AdaptiveColorationShader {
  static fragmentShader = `
  ${this.SHADER_HEADER}
  ${this.PERCEIVED_BRIGHTNESS}

  void main() {
    ${this.FRAGMENT_BEGIN}
    finalColor = color * brightnessPulse * colorationAlpha;
    ${this.COLORATION_TECHNIQUES}
    ${this.ADJUSTMENTS}
    ${this.FALLOFF}
    ${this.FRAGMENT_END}
  }
  `;

  /** @inheritdoc */
  static defaultUniforms = ({...super.defaultUniforms, ratio: 0, brightnessPulse: 1});
}
