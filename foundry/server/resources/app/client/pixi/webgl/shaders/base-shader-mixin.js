/**
 * A mixin which decorates a PIXI.Filter or PIXI.Shader with common properties.
 * @category - Mixins
 * @param {typeof PIXI.Shader} ShaderClass   The parent ShaderClass class being mixed.
 * @returns {typeof BaseShaderMixin}         A Shader/Filter subclass mixed with BaseShaderMixin features.
 * @mixin
 */
const BaseShaderMixin = ShaderClass => {
  class BaseShaderMixin extends ShaderClass {

    /**
     * Useful constant values computed at compile time
     * @type {string}
     */
    static CONSTANTS = `
    const float PI = 3.141592653589793;
    const float TWOPI = 6.283185307179586;
    const float INVPI = 0.3183098861837907;
    const float INVTWOPI = 0.15915494309189535;
    const float SQRT2 = 1.4142135623730951;
    const float SQRT1_2 = 0.7071067811865476;
    const float SQRT3 = 1.7320508075688772;
    const float SQRT1_3 = 0.5773502691896257;
    const vec3 BT709 = vec3(0.2126, 0.7152, 0.0722);
    `;

    /* -------------------------------------------- */

    /**
     * Fast approximate perceived brightness computation
     * Using Digital ITU BT.709 : Exact luminance factors
     * @type {string}
     */
    static PERCEIVED_BRIGHTNESS = `
    float perceivedBrightness(in vec3 color) { return sqrt(dot(BT709, color * color)); }
    float perceivedBrightness(in vec4 color) { return perceivedBrightness(color.rgb); }
    float reversePerceivedBrightness(in vec3 color) { return 1.0 - perceivedBrightness(color); }
    float reversePerceivedBrightness(in vec4 color) { return 1.0 - perceivedBrightness(color.rgb); }
    `;

    /* -------------------------------------------- */

    /**
     * Convertion functions for sRGB and Linear RGB.
     * @type {string}
     */
    static COLOR_SPACES = `
    float luminance(in vec3 c) { return dot(BT709, c); }
    vec3 linear2grey(in vec3 c) { return vec3(luminance(c)); }
    
    vec3 linear2srgb(in vec3 c) {
      vec3 a = 12.92 * c;
      vec3 b = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
      vec3 s = step(vec3(0.0031308), c);
      return mix(a, b, s);
    }

    vec3 srgb2linear(in vec3 c) {
      vec3 a = c / 12.92;
      vec3 b = pow((c + 0.055) / 1.055, vec3(2.4));
      vec3 s = step(vec3(0.04045), c);
      return mix(a, b, s);
    }
    
    vec3 srgb2linearFast(in vec3 c) { return c * c; }
    vec3 linear2srgbFast(in vec3 c) { return sqrt(c); }
    
    vec3 colorClamp(in vec3 c) { return clamp(c, vec3(0.0), vec3(1.0)); }
    vec4 colorClamp(in vec4 c) { return clamp(c, vec4(0.0), vec4(1.0)); }
    
    vec3 tintColorLinear(in vec3 color, in vec3 tint, in float intensity) {
      float t = luminance(tint);
      float c = luminance(color);
      return mix(color, mix(
                            mix(tint, vec3(1.0), (c - t) / (1.0 - t)),
                            tint * (c / t),
                            step(c, t)
                           ), intensity);
    }
    
    vec3 tintColor(in vec3 color, in vec3 tint, in float intensity) {
      return linear2srgbFast(tintColorLinear(srgb2linearFast(color), srgb2linearFast(tint), intensity));
    }
    `;

    /* -------------------------------------------- */

    /**
     * Fractional Brownian Motion for a given number of octaves
     * @param {number} [octaves=4]
     * @param {number} [amp=1.0]
     * @returns {string}
     */
    static FBM(octaves = 4, amp = 1.0) {
      return `float fbm(in vec2 uv) {
        float total = 0.0, amp = ${amp.toFixed(1)};
        for (int i = 0; i < ${octaves}; i++) {
          total += noise(uv) * amp;
          uv += uv;
          amp *= 0.5;
        }
        return total;
      }`;
    }

    /* -------------------------------------------- */

    /**
     * High Quality Fractional Brownian Motion
     * @param {number} [octaves=3]
     * @returns {string}
     */
    static FBMHQ(octaves = 3) {
      return `float fbm(in vec2 uv, in float smoothness) {   
        float s = exp2(-smoothness);
        float f = 1.0;
        float a = 1.0;
        float t = 0.0;
        for( int i = 0; i < ${octaves}; i++ ) {
            t += a * noise(f * uv);
            f *= 2.0;
            a *= s;
        }
        return t;
      }`;
    }

    /* -------------------------------------------- */

    /**
     * Angular constraint working with coordinates on the range [-1, 1]
     * => coord: Coordinates
     * => angle: Angle in radians
     * => smoothness: Smoothness of the pie
     * => l: Length of the pie.
     * @type {string}
     */
    static PIE = `
    float pie(in vec2 coord, in float angle, in float smoothness, in float l) {   
      coord.x = abs(coord.x);
      vec2 va = vec2(sin(angle), cos(angle));
      float lg = length(coord) - l;
      float clg = length(coord - va * clamp(dot(coord, va) , 0.0, l));
      return smoothstep(0.0, smoothness, max(lg, clg * sign(va.y * coord.x - va.x * coord.y)));
    }`;

    /* -------------------------------------------- */

    /**
     * A conventional pseudo-random number generator with the "golden" numbers, based on uv position
     * @type {string}
     */
    static PRNG_LEGACY = `
    float random(in vec2 uv) { 
      return fract(cos(dot(uv, vec2(12.9898, 4.1414))) * 43758.5453);
    }`;

    /* -------------------------------------------- */

    /**
     * A pseudo-random number generator based on uv position which does not use cos/sin
     * This PRNG replaces the old PRNG_LEGACY to workaround some driver bugs
     * @type {string}
     */
    static PRNG = `
    float random(in vec2 uv) { 
      uv = mod(uv, 1000.0);
      return fract( dot(uv, vec2(5.23, 2.89) 
                        * fract((2.41 * uv.x + 2.27 * uv.y)
                                 * 251.19)) * 551.83);
    }`;

    /* -------------------------------------------- */

    /**
     * A Vec2 pseudo-random generator, based on uv position
     * @type {string}
     */
    static PRNG2D = `
    vec2 random(in vec2 uv) {
      vec2 uvf = fract(uv * vec2(0.1031, 0.1030));
      uvf += dot(uvf, uvf.yx + 19.19);
      return fract((uvf.x + uvf.y) * uvf);
    }`;

    /* -------------------------------------------- */

    /**
     * A Vec3 pseudo-random generator, based on uv position
     * @type {string}
     */
    static PRNG3D = `
    vec3 random(in vec3 uv) {
      return vec3(fract(cos(dot(uv, vec3(12.9898,  234.1418,    152.01))) * 43758.5453),
                  fract(sin(dot(uv, vec3(80.9898,  545.8937, 151515.12))) * 23411.1789),
                  fract(cos(dot(uv, vec3(01.9898, 1568.5439,    154.78))) * 31256.8817));
    }`;

    /* -------------------------------------------- */

    /**
     * A conventional noise generator
     * @type {string}
     */
    static NOISE = `
    float noise(in vec2 uv) {
      const vec2 d = vec2(0.0, 1.0);
      vec2 b = floor(uv);
      vec2 f = smoothstep(vec2(0.), vec2(1.0), fract(uv));
      return mix(
        mix(random(b), random(b + d.yx), f.x), 
        mix(random(b + d.xy), random(b + d.yy), f.x), 
        f.y
      );
    }`;

    /* -------------------------------------------- */

    /**
     * Convert a Hue-Saturation-Brightness color to RGB - useful to convert polar coordinates to RGB
     * @type {string}
     */
    static HSB2RGB = `
    vec3 hsb2rgb(in vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0), 6.0)-3.0)-1.0, 0.0, 1.0 );
      rgb = rgb*rgb*(3.0-2.0*rgb);
      return c.z * mix(vec3(1.0), rgb, c.y);
    }`;

    /* -------------------------------------------- */

    /**
     * Declare a wave function in a shader -> wcos (default), wsin or wtan.
     * Wave on the [v1,v2] range with amplitude -> a and speed -> speed.
     * @param {string} [func="cos"]     the math function to use
     * @returns {string}
     */
    static WAVE(func="cos") {
      return `
      float w${func}(in float v1, in float v2, in float a, in float speed) {
        float w = ${func}( speed + a ) + 1.0;
        return (v1 - v2) * (w * 0.5) + v2;
      }`;
    }

    /* -------------------------------------------- */

    /**
     * Rotation function.
     * @type {string}
     */
    static ROTATION = `
    mat2 rot(in float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c);
    }
    `;

    /* -------------------------------------------- */

    /**
     * Voronoi noise function. Needs PRNG2D and CONSTANTS.
     * @see PRNG2D
     * @see CONSTANTS
     * @type {string}
     */
    static VORONOI = `
    vec3 voronoi(in vec2 uv, in float t, in float zd) {
      vec3 vor = vec3(0.0, 0.0, zd);
      vec2 uvi = floor(uv);
      vec2 uvf = fract(uv);
      for ( float j = -1.0; j <= 1.0; j++ ) {
        for ( float i = -1.0; i <= 1.0; i++ ) {
          vec2 uvn = vec2(i, j);
          vec2 uvr = 0.5 * sin(TWOPI * random(uvi + uvn) + t) + 0.5;
          uvr = 0.5 * sin(TWOPI * uvr + t) + 0.5;
          vec2 uvd = uvn + uvr - uvf;
          float dist = length(uvd);
          if ( dist < vor.z ) {
            vor.xy = uvr;
            vor.z = dist;
          }
        }
      }
      return vor;
    }
    
    vec3 voronoi(in vec2 vuv, in float zd)  { 
      return voronoi(vuv, 0.0, zd); 
    }

    vec3 voronoi(in vec3 vuv, in float zd)  { 
      return voronoi(vuv.xy, vuv.z, zd);
    }
    `;

    /* -------------------------------------------- */

    /**
     * Enables GLSL 1.0 backwards compatibility in GLSL 3.00 ES vertex shaders.
     * @type {string}
     */
    static GLSL1_COMPATIBILITY_VERTEX = `
      #define attribute in
      #define varying out
    `;

    /* -------------------------------------------- */

    /**
     * Enables GLSL 1.0 backwards compatibility in GLSL 3.00 ES fragment shaders.
     * @type {string}
     */
    static GLSL1_COMPATIBILITY_FRAGMENT = `
      #define varying in
      #define texture2D texture
      #define textureCube texture
      #define texture2DProj textureProj
      #define texture2DLodEXT textureLod
      #define texture2DProjLodEXT textureProjLod
      #define textureCubeLodEXT textureLod
      #define texture2DGradEXT textureGrad
      #define texture2DProjGradEXT textureProjGrad
      #define textureCubeGradEXT textureGrad
      #define gl_FragDepthEXT gl_FragDepth
    `;
  }
  return BaseShaderMixin;
};
