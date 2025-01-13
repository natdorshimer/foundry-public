/**
 * A filter which implements an outline.
 * Inspired from https://github.com/pixijs/filters/tree/main/filters/outline
 * @license MIT
 */
class OutlineOverlayFilter extends AbstractBaseFilter {
  /** @override */
  padding = 3;

  /** @override */
  autoFit = false;

  /**
   * If the filter is animated or not.
   * @type {boolean}
   */
  animated = true;

  /** @inheritdoc */
  static defaultUniforms = {
    outlineColor: [1, 1, 1, 1],
    thickness: [1, 1],
    alphaThreshold: 0.60,
    knockout: true,
    wave: false
  };

  /** @override */
  static vertexShader = `
  attribute vec2 aVertexPosition;

  uniform mat3 projectionMatrix;
  uniform vec2 screenDimensions;
  uniform vec4 inputSize;
  uniform vec4 outputFrame;

  varying vec2 vTextureCoord;
  varying vec2 vFilterCoord;

  vec4 filterVertexPosition( void ) {
      vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.)) + outputFrame.xy;
      return vec4((projectionMatrix * vec3(position, 1.0)).xy, 0., 1.);
  }

  // getting normalized coord for the tile texture
  vec2 filterTextureCoord( void ) {
      return aVertexPosition * (outputFrame.zw * inputSize.zw);
  }

  // getting normalized coord for a screen sized mask render texture
  vec2 filterCoord( in vec2 textureCoord ) {
    return textureCoord * inputSize.xy / outputFrame.zw;
  }

  void main() {
    vTextureCoord = filterTextureCoord();
    vFilterCoord = filterCoord(vTextureCoord);
    gl_Position = filterVertexPosition();
  }`;


  /**
   * Dynamically create the fragment shader used for filters of this type.
   * @returns {string}
   */
  static createFragmentShader() {
    return `
    varying vec2 vTextureCoord;
    varying vec2 vFilterCoord;
    uniform sampler2D uSampler;
    
    uniform vec2 thickness;
    uniform vec4 outlineColor;
    uniform vec4 filterClamp;
    uniform float alphaThreshold;
    uniform float time;
    uniform bool knockout;
    uniform bool wave;
    
    ${this.CONSTANTS}
    ${this.WAVE()}
    
    void main(void) {
        float dist = distance(vFilterCoord, vec2(0.5)) * 2.0;
        vec4 ownColor = texture2D(uSampler, vTextureCoord);
        vec4 wColor = wave ? outlineColor * 
                             wcos(0.0, 1.0, dist * 75.0, 
                                  -time * 0.01 + 3.0 * dot(vec4(1.0), ownColor)) 
                             * 0.33 * (1.0 - dist) : vec4(0.0);
        float texAlpha = smoothstep(alphaThreshold, 1.0, ownColor.a);
        vec4 curColor;
        float maxAlpha = 0.;
        vec2 displaced;
        for ( float angle = 0.0; angle <= TWOPI; angle += ${this.#quality.toFixed(7)} ) {
            displaced.x = vTextureCoord.x + thickness.x * cos(angle);
            displaced.y = vTextureCoord.y + thickness.y * sin(angle);
            curColor = texture2D(uSampler, clamp(displaced, filterClamp.xy, filterClamp.zw));
            curColor.a = clamp((curColor.a - 0.6) * 2.5, 0.0, 1.0);
            maxAlpha = max(maxAlpha, curColor.a);
        }
        float resultAlpha = max(maxAlpha, texAlpha);
        vec3 result = ((knockout ? vec3(0.0) : ownColor.rgb) + outlineColor.rgb * (1.0 - texAlpha)) * resultAlpha;
        gl_FragColor = mix(vec4(result, resultAlpha), wColor, texAlpha);
    }
    `;
  }

  /* -------------------------------------------- */

  /**
   * Quality of the outline according to performance mode.
   * @returns {number}
   */
  static get #quality() {
    switch ( canvas.performance.mode ) {
      case CONST.CANVAS_PERFORMANCE_MODES.LOW:
        return (Math.PI * 2) / 10;
      case CONST.CANVAS_PERFORMANCE_MODES.MED:
        return (Math.PI * 2) / 20;
      default:
        return (Math.PI * 2) / 30;
    }
  }

  /* -------------------------------------------- */

  /**
   * The thickness of the outline.
   * @type {number}
   */
  get thickness() {
    return this.#thickness;
  }

  set thickness(value) {
    this.#thickness = value;
    this.padding = value * 1.5;
  }

  #thickness = 3;

  /* -------------------------------------------- */

  /** @inheritdoc */
  static create(initialUniforms={}) {
    const uniforms = {...this.defaultUniforms, ...initialUniforms};
    return new this(this.vertexShader, this.createFragmentShader(), uniforms);
  }

  /* -------------------------------------------- */

  /** @override */
  apply(filterManager, input, output, clear) {
    if ( canvas.photosensitiveMode ) this.uniforms.wave = false;
    let time = 0;
    let thickness = this.#thickness * canvas.stage.scale.x;
    if ( this.animated && !canvas.photosensitiveMode ) {
      time = canvas.app.ticker.lastTime;
      thickness *= Math.oscillation(0.75, 1.25, time, 1500);
    }
    this.uniforms.time = time;
    this.uniforms.thickness[0] = thickness / input._frame.width;
    this.uniforms.thickness[1] = thickness / input._frame.height;
    filterManager.applyFilter(this, input, output, clear);
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get animate() {
    const msg = "OutlineOverlayFilter#animate is deprecated in favor of OutlineOverlayFilter#animated.";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
    return this.animated;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  set animate(v) {
    const msg = "OutlineOverlayFilter#animate is deprecated in favor of OutlineOverlayFilter#animated.";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
    this.animated = v;
  }
}
