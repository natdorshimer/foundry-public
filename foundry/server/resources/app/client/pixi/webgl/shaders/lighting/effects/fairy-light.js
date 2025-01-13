/**
 * Fairy light animation coloration shader
 */
class FairyLightColorationShader extends AdaptiveColorationShader {

  /** @override */
  static forceDefaultColor = true;

  /** @override */
  static fragmentShader = `
  ${this.SHADER_HEADER}
  ${this.HSB2RGB}
  ${this.PRNG}
  ${this.NOISE}
  ${this.FBM(3, 1.0)}
  ${this.PERCEIVED_BRIGHTNESS}

  void main() {
    ${this.FRAGMENT_BEGIN}
    
    // Creating distortion with vUvs and fbm
    float distortion1 = fbm(vec2( 
                        fbm(vUvs * 3.0 + time * 0.50), 
                        fbm((-vUvs + vec2(1.)) * 5.0 + time * INVTHREE)));
    
    float distortion2 = fbm(vec2(
                        fbm(-vUvs * 3.0 + time * 0.50),
                        fbm((-vUvs + vec2(1.)) * 5.0 - time * INVTHREE)));
    vec2 uv = vUvs;
      
    // time related var
    float t = time * 0.5;
    float tcos = 0.5 * (0.5 * (cos(t)+1.0)) + 0.25;
    float tsin = 0.5 * (0.5 * (sin(t)+1.0)) + 0.25;
    
    // Creating distortions with cos and sin : create fluidity
    uv -= PIVOT;
    uv *= tcos * distortion1;
    uv *= tsin * distortion2;
    uv *= fbm(vec2(time + distortion1, time + distortion2));
    uv += PIVOT;

    // Creating the rainbow
    float intens = intensity * 0.1;
    vec2 nuv = vUvs * 2.0 - 1.0;
    vec2 puv = vec2(atan(nuv.x, nuv.y) * INVTWOPI + 0.5, length(nuv));
    vec3 rainbow = hsb2rgb(vec3(puv.x + puv.y - time * 0.2, 1.0, 1.0));
    vec3 mixedColor = mix(color, rainbow, smoothstep(0.0, 1.5 - intens, dist));

    finalColor = distortion1 * distortion1 * 
                 distortion2 * distortion2 * 
                 mixedColor * colorationAlpha * (1.0 - dist * dist * dist) *
                 mix( uv.x + distortion1 * 4.5 * (intensity * 0.4),
                      uv.y + distortion2 * 4.5 * (intensity * 0.4), tcos);
    ${this.COLORATION_TECHNIQUES}
    ${this.ADJUSTMENTS}
    ${this.FALLOFF}
    ${this.FRAGMENT_END}
  }`;
}

/* -------------------------------------------- */

/**
 * Fairy light animation illumination shader
 */
class FairyLightIlluminationShader extends AdaptiveIlluminationShader {
  static fragmentShader = `
  ${this.SHADER_HEADER}
  ${this.PERCEIVED_BRIGHTNESS}
  ${this.PRNG}
  ${this.NOISE}
  ${this.FBM(3, 1.0)}

  void main() {
    ${this.FRAGMENT_BEGIN}
    
    // Creating distortion with vUvs and fbm
    float distortion1 = fbm(vec2( 
                        fbm(vUvs * 3.0 - time * 0.50), 
                        fbm((-vUvs + vec2(1.)) * 5.0 + time * INVTHREE)));
    
    float distortion2 = fbm(vec2(
                        fbm(-vUvs * 3.0 - time * 0.50),
                        fbm((-vUvs + vec2(1.)) * 5.0 - time * INVTHREE)));
      
    // linear interpolation motion
    float motionWave = 0.5 * (0.5 * (cos(time * 0.5) + 1.0)) + 0.25;
    ${this.TRANSITION}
    finalColor *= mix(distortion1, distortion2, motionWave);
    ${this.ADJUSTMENTS}
    ${this.FALLOFF}
    ${this.FRAGMENT_END}
  }`;
}
