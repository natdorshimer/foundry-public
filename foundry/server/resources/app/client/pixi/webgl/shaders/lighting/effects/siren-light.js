/**
 * Siren light animation coloration shader
 */
class SirenColorationShader extends AdaptiveColorationShader {
  static fragmentShader = `
  ${this.SHADER_HEADER}
  uniform float gradientFade;
  uniform float beamLength;
  
  ${this.PERCEIVED_BRIGHTNESS}
  ${this.PIE}
  ${this.ROTATION}

  void main() {
    ${this.FRAGMENT_BEGIN}
    vec2 ncoord = vUvs * 2.0 - 1.0;
    float angularIntensity = mix(PI, 0.0, intensity * 0.1);
    ncoord *= rot(time * 50.0 + angle);
    float angularCorrection = pie(ncoord, angularIntensity, clamp(gradientFade * dist, 0.05, 1.0), beamLength);
    finalColor = color * brightnessPulse * colorationAlpha * angularCorrection;
    ${this.COLORATION_TECHNIQUES}
    ${this.ADJUSTMENTS}
    ${this.FALLOFF}
    ${this.FRAGMENT_END}
  }
  `;

  /** @inheritdoc */
  static defaultUniforms = ({
    ...super.defaultUniforms,
    ratio: 0,
    brightnessPulse: 1,
    angle: 0,
    gradientFade: 0.15,
    beamLength: 1
  });
}

/* -------------------------------------------- */

/**
 * Siren light animation illumination shader
 */
class SirenIlluminationShader extends AdaptiveIlluminationShader {
  static fragmentShader = `
  ${this.SHADER_HEADER}
  uniform float gradientFade;
  uniform float beamLength;
  
  ${this.PERCEIVED_BRIGHTNESS}
  ${this.PIE}
  ${this.ROTATION}

  void main() {
    ${this.FRAGMENT_BEGIN}
    ${this.TRANSITION}
    vec2 ncoord = vUvs * 2.0 - 1.0;
    float angularIntensity = mix(PI, 0.0, intensity * 0.1);
    ncoord *= rot(time * 50.0 + angle);
    float angularCorrection = mix(1.0, pie(ncoord, angularIntensity, clamp(gradientFade * dist, 0.05, 1.0), beamLength), 0.5);
    finalColor *= angularCorrection;
    ${this.ADJUSTMENTS}
    ${this.FALLOFF}
    ${this.FRAGMENT_END}
  }`;

  /** @inheritdoc */
  static defaultUniforms = ({
    ...super.defaultUniforms,
    angle: 0,
    gradientFade: 0.45,
    beamLength: 1
  });
}
