/**
 * The shader definition which powers the TokenRing.
 */
class TokenRingSamplerShader extends PrimaryBaseSamplerShader {

  /** @override */
  static classPluginName = "tokenRingBatch";

  /* -------------------------------------------- */

  /** @override */
  static pausable = false;

  /* -------------------------------------------- */

  /** @inheritdoc */
  static batchGeometry = [
    ...(super.batchGeometry ?? []),
    {id: "aRingTextureCoord", size: 2, normalized: false, type: PIXI.TYPES.FLOAT},
    {id: "aBackgroundTextureCoord", size: 2, normalized: false, type: PIXI.TYPES.FLOAT},
    {id: "aRingColor", size: 4, normalized: true, type: PIXI.TYPES.UNSIGNED_BYTE},
    {id: "aBackgroundColor", size: 4, normalized: true, type: PIXI.TYPES.UNSIGNED_BYTE},
    {id: "aStates", size: 1, normalized: false, type: PIXI.TYPES.FLOAT},
    {id: "aScaleCorrection", size: 2, normalized: false, type: PIXI.TYPES.FLOAT},
    {id: "aRingColorBand", size: 2, normalized: false, type: PIXI.TYPES.FLOAT},
    {id: "aTextureScaleCorrection", size: 1, normalized: false, type: PIXI.TYPES.FLOAT}
  ];

  /* -------------------------------------------- */

  /** @inheritdoc */
  static batchVertexSize = super.batchVertexSize + 12;

  /* -------------------------------------------- */

  /** @inheritdoc */
  static reservedTextureUnits = super.reservedTextureUnits + 1;

  /* -------------------------------------------- */

  /**
   * A null UVs array used for nulled texture position.
   * @type {Float32Array}
   */
  static nullUvs = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]);

  /* -------------------------------------------- */

  /** @inheritdoc */
  static batchDefaultUniforms(maxTex) {
    return {
      ...super.batchDefaultUniforms(maxTex),
      tokenRingTexture: maxTex + super.reservedTextureUnits,
      time: 0
    };
  }

  /* -------------------------------------------- */

  /** @override */
  static _preRenderBatch(batchRenderer) {
    super._preRenderBatch(batchRenderer);
    batchRenderer.renderer.texture.bind(CONFIG.Token.ring.ringClass.baseTexture,
      batchRenderer.uniforms.tokenRingTexture);
    batchRenderer.uniforms.time = canvas.app.ticker.lastTime / 1000;
    batchRenderer.uniforms.debugColorBands = CONFIG.Token.ring.debugColorBands;
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static _packInterleavedGeometry(element, attributeBuffer, indexBuffer, aIndex, iIndex) {
    super._packInterleavedGeometry(element, attributeBuffer, indexBuffer, aIndex, iIndex);
    const {float32View, uint32View} = attributeBuffer;

    // Prepare token ring attributes
    const vertexData = element.vertexData;
    const trConfig = CONFIG.Token.ringClass;
    const object = element.object.object || {};
    const ringColor = PIXI.Color.shared.setValue(object.ring?.ringColorLittleEndian ?? 0xFFFFFF).toNumber();
    const bkgColor = PIXI.Color.shared.setValue(object.ring?.bkgColorLittleEndian ?? 0xFFFFFF).toNumber();
    const ringUvsFloat = object.ring?.ringUVs ?? trConfig.tokenRingSamplerShader.nullUvs;
    const bkgUvsFloat = object.ring?.bkgUVs ?? trConfig.tokenRingSamplerShader.nullUvs;
    const states = (object.ring?.effects ?? 0) + 0.5;
    const scaleCorrectionX = (object.ring?.scaleCorrection ?? 1) * (object.ring?.scaleAdjustmentX ?? 1);
    const scaleCorrectionY = (object.ring?.scaleCorrection ?? 1) * (object.ring?.scaleAdjustmentY ?? 1);
    const colorBandRadiusStart = object.ring?.colorBand.startRadius ?? 0;
    const colorBandRadiusEnd = object.ring?.colorBand.endRadius ?? 0;
    const textureScaleAdjustment = object.ring?.textureScaleAdjustment ?? 1;

    // Write attributes into buffer
    const vertexSize = this.vertexSize;
    const attributeOffset = PrimaryBaseSamplerShader.batchVertexSize;
    for ( let i = 0, j = attributeOffset; i < vertexData.length; i += 2, j += vertexSize ) {
      let k = aIndex + j;
      float32View[k++] = ringUvsFloat[i];
      float32View[k++] = ringUvsFloat[i + 1];
      float32View[k++] = bkgUvsFloat[i];
      float32View[k++] = bkgUvsFloat[i + 1];
      uint32View[k++] = ringColor;
      uint32View[k++] = bkgColor;
      float32View[k++] = states;
      float32View[k++] = scaleCorrectionX;
      float32View[k++] = scaleCorrectionY;
      float32View[k++] = colorBandRadiusStart;
      float32View[k++] = colorBandRadiusEnd;
      float32View[k++] = textureScaleAdjustment;
    }
  }

  /* ---------------------------------------- */
  /*  GLSL Shader Code                        */
  /* ---------------------------------------- */

  /**
   * The fragment shader header.
   * @type {string}
   */
  static #FRAG_HEADER = `
    const uint STATE_RING_PULSE = 0x02U;
    const uint STATE_RING_GRADIENT = 0x04U;
    const uint STATE_BKG_WAVE = 0x08U;
    const uint STATE_INVISIBLE = 0x10U;

    /* -------------------------------------------- */

    bool hasState(in uint state) {
      return (vStates & state) == state;
    }

    /* -------------------------------------------- */

    vec2 rotation(in vec2 uv, in float a) {
      uv -= 0.5;
      float s = sin(a);
      float c = cos(a);
      return uv * mat2(c, -s, s, c) + 0.5;
    }

    /* -------------------------------------------- */

    float normalizedCos(in float val) {
      return (cos(val) + 1.0) * 0.5;
    }

    /* -------------------------------------------- */

    float wave(in float dist) {
      float sinWave = 0.5 * (sin(-time * 4.0 + dist * 100.0) + 1.0);
      return mix(1.0, 0.55 * sinWave + 0.8, clamp(1.0 - dist, 0.0, 1.0));
    }

    /* -------------------------------------------- */

    vec4 colorizeTokenRing(in vec4 tokenRing, in float dist) {
      if ( tokenRing.a > 0.0 ) tokenRing.rgb /= tokenRing.a;
      vec3 rcol = hasState(STATE_RING_PULSE)
                  ? mix(tokenRing.rrr, tokenRing.rrr * 0.35, (cos(time * 2.0) + 1.0) * 0.5)
                  : tokenRing.rrr;
      vec3 ccol = vRingColor * rcol;
      vec3 gcol = hasState(STATE_RING_GRADIENT)
              ? mix(ccol, vBackgroundColor * tokenRing.r, smoothstep(0.0, 1.0, dot(rotation(vTextureCoord, time), vec2(0.5))))
              : ccol;
      vec3 col = mix(tokenRing.rgb, gcol, step(vRingColorBand.x, dist) - step(vRingColorBand.y, dist));
      return vec4(col, 1.0) * tokenRing.a;
    }

    /* -------------------------------------------- */

    vec4 colorizeTokenBackground(in vec4 tokenBackground, in float dist) {
      if (tokenBackground.a > 0.0) tokenBackground.rgb /= tokenBackground.a;
    
      float wave = hasState(STATE_BKG_WAVE) ? (0.5 + wave(dist) * 1.5) : 1.0;
      vec3 bgColor = tokenBackground.rgb;
      vec3 tintColor = vBackgroundColor.rgb;
      vec3 resultColor;
  
      // Overlay blend mode
      if ( tintColor == vec3(1.0, 1.0, 1.0) ) {
        // If tint color is pure white, keep the original background color
        resultColor = bgColor;
      } else {
        // Overlay blend mode
        for ( int i = 0; i < 3; i++ ) {
          if ( bgColor[i] < 0.5 ) resultColor[i] = 2.0 * bgColor[i] * tintColor[i];
          else resultColor[i] = 1.0 - 2.0 * (1.0 - bgColor[i]) * (1.0 - tintColor[i]);
        }
      }
      return vec4(resultColor, 1.0) * tokenBackground.a * wave;
    }

    /* -------------------------------------------- */

    vec4 processTokenColor(in vec4 finalColor) {
      if ( !hasState(STATE_INVISIBLE) ) return finalColor;

      // Computing halo
      float lum = perceivedBrightness(finalColor.rgb);
      vec3 haloColor = vec3(lum) * vec3(0.5, 1.0, 1.0);

      // Construct final image
      return vec4(haloColor, 1.0) * finalColor.a
                   * (0.55 + normalizedCos(time * 2.0) * 0.25);
    }

    /* -------------------------------------------- */

    vec4 blend(vec4 src, vec4 dst) {
      return src + (dst * (1.0 - src.a));
    }
    
    /* -------------------------------------------- */
    
    float getTokenTextureClip() {
      return step(3.5,
           step(0.0, vTextureCoord.x) +
           step(0.0, vTextureCoord.y) +
           step(vTextureCoord.x, 1.0) +
           step(vTextureCoord.y, 1.0));
    }
  `;

  /* ---------------------------------------- */

  /**
   * Fragment shader body.
   * @type {string}
   */
  static #FRAG_MAIN = `
    vec4 color;
    vec4 result;

    %forloop%

    if ( vStates == 0U ) result = color * vColor;
    else {
      // Compute distances
      vec2 scaledDistVec = (vOrigTextureCoord - 0.5) * 2.0 * vScaleCorrection;
      
      // Euclidean distance computation
      float dist = length(scaledDistVec);
      
      // Rectangular distance computation
      vec2 absScaledDistVec = abs(scaledDistVec);
      float rectangularDist = max(absScaledDistVec.x, absScaledDistVec.y);
      
      // Clip token texture color (necessary when a mesh is padded on x and/or y axis)
      color *= getTokenTextureClip();
      
      // Blend token texture, token ring and token background
      result = blend(
        processTokenColor(color * (vColor / vColor.a)),
        blend(
          colorizeTokenRing(texture(tokenRingTexture, vRingTextureCoord), dist),
          colorizeTokenBackground(texture(tokenRingTexture, vBackgroundTextureCoord), dist)
        ) * step(rectangularDist, 1.0)
      ) * vColor.a;
    }
  `;

  /* ---------------------------------------- */

  /**
   * Fragment shader body for debug code.
   * @type {string}
   */
  static #FRAG_MAIN_DEBUG = `
    if ( debugColorBands ) {
      vec2 scaledDistVec = (vTextureCoord - 0.5) * 2.0 * vScaleCorrection;
      float dist = length(scaledDistVec);
      result.rgb += vec3(0.0, 0.5, 0.0) * (step(vRingColorBand.x, dist) - step(vRingColorBand.y, dist));
    }
  `;

  /* ---------------------------------------- */

  /** @override */
  static _batchVertexShader = `
    in vec2 aRingTextureCoord;
    in vec2 aBackgroundTextureCoord;
    in vec2 aScaleCorrection;
    in vec2 aRingColorBand;
    in vec4 aRingColor;
    in vec4 aBackgroundColor;
    in float aTextureScaleCorrection;
    in float aStates;

    out vec2 vRingTextureCoord;
    out vec2 vBackgroundTextureCoord;
    out vec2 vOrigTextureCoord;
    flat out vec2 vRingColorBand;
    flat out vec3 vRingColor;
    flat out vec3 vBackgroundColor;
    flat out vec2 vScaleCorrection;
    flat out uint vStates;

    void _main(out vec2 vertexPosition, out vec2 textureCoord, out vec4 color) {
      vRingTextureCoord = aRingTextureCoord;
      vBackgroundTextureCoord = aBackgroundTextureCoord;
      vRingColor = aRingColor.rgb;
      vBackgroundColor = aBackgroundColor.rgb;
      vStates = uint(aStates);
      vScaleCorrection = aScaleCorrection;
      vRingColorBand = aRingColorBand;
      vOrigTextureCoord = aTextureCoord;
      vertexPosition = (translationMatrix * vec3(aVertexPosition, 1.0)).xy;
      textureCoord = (aTextureCoord - 0.5) * aTextureScaleCorrection + 0.5;
      color = aColor * tint;
    }
  `;

  /* -------------------------------------------- */

  /** @override */
  static _batchFragmentShader = `
    in vec2 vRingTextureCoord;
    in vec2 vBackgroundTextureCoord;
    in vec2 vOrigTextureCoord;
    flat in vec3 vRingColor;
    flat in vec3 vBackgroundColor;
    flat in vec2 vScaleCorrection;
    flat in vec2 vRingColorBand;
    flat in uint vStates;

    uniform sampler2D tokenRingTexture;
    uniform float time;
    uniform bool debugColorBands;

    ${this.CONSTANTS}
    ${this.PERCEIVED_BRIGHTNESS}
    ${TokenRingSamplerShader.#FRAG_HEADER}

    vec4 _main() {
      ${TokenRingSamplerShader.#FRAG_MAIN}
      ${TokenRingSamplerShader.#FRAG_MAIN_DEBUG}
      return result;
    }
  `;
}
