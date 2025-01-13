/**
 * Wave animation illumination shader
 */
class WaveIlluminationShader extends AdaptiveIlluminationShader {
  static fragmentShader = `
  ${this.SHADER_HEADER}
  ${this.PERCEIVED_BRIGHTNESS}

  float wave(in float dist) {
    float sinWave = 0.5 * (sin(-time * 6.0 + dist * 10.0 * intensity) + 1.0);
    return 0.3 * sinWave + 0.8;
  }

  void main() {
    ${this.FRAGMENT_BEGIN}
    ${this.TRANSITION}
    finalColor *= wave(dist);
    ${this.ADJUSTMENTS}
    ${this.FALLOFF}
    ${this.FRAGMENT_END}
  }`;
}

/* -------------------------------------------- */

/**
 * Wave animation coloration shader
 */
class WaveColorationShader extends AdaptiveColorationShader {
  static fragmentShader = `
  ${this.SHADER_HEADER}
  ${this.PERCEIVED_BRIGHTNESS}

  float wave(in float dist) {
    float sinWave = 0.5 * (sin(-time * 6.0 + dist * 10.0 * intensity) + 1.0);
    return 0.55 * sinWave + 0.8;
  }

  void main() {
    ${this.FRAGMENT_BEGIN}
    finalColor = color * wave(dist) * colorationAlpha;
    ${this.COLORATION_TECHNIQUES}
    ${this.ADJUSTMENTS}
    ${this.FALLOFF}
    ${this.FRAGMENT_END}
  }`;
}
