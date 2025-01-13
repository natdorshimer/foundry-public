/**
 * Chroma animation coloration shader
 */
class ChromaColorationShader extends AdaptiveColorationShader {

  /** @override */
  static forceDefaultColor = true;

  /** @override */
  static fragmentShader = `
  ${this.SHADER_HEADER}
  ${this.HSB2RGB}
  ${this.PERCEIVED_BRIGHTNESS}

  void main() {
    ${this.FRAGMENT_BEGIN}
    finalColor = mix( color, 
                      hsb2rgb(vec3(time * 0.25, 1.0, 1.0)),
                      intensity * 0.1 ) * colorationAlpha;
    ${this.COLORATION_TECHNIQUES}
    ${this.ADJUSTMENTS}
    ${this.FALLOFF}
    ${this.FRAGMENT_END}
  }`;
}
