/**
 * Dynamic Token Ring Manager.
 */
export default class TokenRing {
  /**
   * A TokenRing is constructed by providing a reference to a Token object.
   * @param {Token} token
   */
  constructor(token) {
    this.#token = new WeakRef(token);
  }

  /* -------------------------------------------- */
  /*  Rings System                                */
  /* -------------------------------------------- */

  /**
   * The start and end radii of the token ring color band.
   * @typedef {Object} RingColorBand
   * @property {number} startRadius   The starting normalized radius of the token ring color band.
   * @property {number} endRadius     The ending normalized radius of the token ring color band.
   */

  /* -------------------------------------------- */

  /**
   * The effects which could be applied to a token ring (using bitwise operations).
   * @type {Readonly<Record<string, number>>}
   */
  static effects = Object.freeze({
    DISABLED: 0x00,
    ENABLED: 0x01,
    RING_PULSE: 0x02,
    RING_GRADIENT: 0x04,
    BKG_WAVE: 0x08,
    INVISIBILITY: 0x10  // or spectral pulse effect
  });

  /* -------------------------------------------- */

  /**
   * Is the token rings framework enabled? Will be `null` if the system hasn't initialized yet.
   * @type {boolean|null}
   */
  static get initialized() {
    return this.#initialized;
  }

  static #initialized = null;

  /* -------------------------------------------- */

  /**
   * Token Rings sprite sheet base texture.
   * @type {PIXI.BaseTexture}
   */
  static baseTexture;

  /**
   * Rings and background textures UVs and center offset.
   * @type {Record<string, {UVs: Float32Array, center: {x: number, y: number}}>}
   */
  static texturesData;

  /**
   * The token ring shader class definition.
   * @type {typeof TokenRingSamplerShader}
   */
  static tokenRingSamplerShader;

  /**
   * Ring data with their ring name, background name and their grid dimension target.
   * @type {{ringName: string, bkgName: string, colorBand: RingColorBand, gridTarget: number,
   * defaultRingColorLittleEndian: number|null, defaultBackgroundColorLittleEndian: number|null,
   * subjectScaleAdjustment: number}[]}
   */
  static #ringData;

  /**
   * Default ring thickness in normalized space.
   * @type {number}
   */
  static #defaultRingThickness = 0.1269848;

  /**
   * Default ring subject thickness in normalized space.
   * @type {number}
   */
  static #defaultSubjectThickness = 0.6666666;

  /* -------------------------------------------- */

  /**
   * Initialize the Token Rings system, registering the batch plugin and patching PrimaryCanvasGroup#addToken.
   */
  static initialize() {
    if ( TokenRing.#initialized ) return;
    TokenRing.#initialized = true;
    // Register batch plugin
    this.tokenRingSamplerShader = CONFIG.Token.ring.shaderClass;
    this.tokenRingSamplerShader.registerPlugin();
  }

  /* -------------------------------------------- */

  /**
   * Create texture UVs for each asset into the token rings sprite sheet.
   */
  static createAssetsUVs() {
    const spritesheet = TextureLoader.loader.getCache(CONFIG.Token.ring.spritesheet);
    if ( !spritesheet ) throw new Error("TokenRing UV generation failed because no spritesheet was loaded!");

    this.baseTexture = spritesheet.baseTexture;
    this.texturesData = {};
    this.#ringData = [];

    const {
      defaultColorBand={startRadius: 0.59, endRadius: 0.7225},
      defaultRingColor: drc,
      defaultBackgroundColor: dbc
    } = spritesheet.data.config ?? {};
    const defaultRingColor = Color.from(drc);
    const defaultBackgroundColor = Color.from(dbc);
    const validDefaultRingColor = defaultRingColor.valid ? defaultRingColor.littleEndian : null;
    const validDefaultBackgroundColor = defaultBackgroundColor.valid ? defaultBackgroundColor.littleEndian : null;

    const frames = Object.keys(spritesheet.data.frames || {});

    for ( const asset of frames ) {
      const assetTexture = PIXI.Assets.cache.get(asset);
      if ( !assetTexture ) continue;

      // Extracting texture UVs
      const frame = assetTexture.frame;
      const textureUvs = new PIXI.TextureUvs();
      textureUvs.set(frame, assetTexture.baseTexture, assetTexture.rotate);
      this.texturesData[asset] = {
        UVs: textureUvs.uvsFloat32,
        center: {
          x: frame.center.x / assetTexture.baseTexture.width,
          y: frame.center.y / assetTexture.baseTexture.height
        }
      };

      // Skip background assets
      if ( asset.includes("-bkg") ) continue;

      // Extracting and determining final colors
      const { ringColor: rc, backgroundColor: bc, colorBand, gridTarget, ringThickness=this.#defaultRingThickness }
        = spritesheet.data.frames[asset] || {};

      const ringColor = Color.from(rc);
      const backgroundColor = Color.from(bc);

      const finalRingColor = ringColor.valid ? ringColor.littleEndian : validDefaultRingColor;
      const finalBackgroundColor = backgroundColor.valid ? backgroundColor.littleEndian : validDefaultBackgroundColor;
      const subjectScaleAdjustment = 1 / (ringThickness + this.#defaultSubjectThickness);

      this.#ringData.push({
        ringName: asset,
        bkgName: `${asset}-bkg`,
        colorBand: foundry.utils.deepClone(colorBand ?? defaultColorBand),
        gridTarget: gridTarget ?? 1,
        defaultRingColorLittleEndian: finalRingColor,
        defaultBackgroundColorLittleEndian: finalBackgroundColor,
        subjectScaleAdjustment
      });
    }

    // Sorting the rings data array
    this.#ringData.sort((a, b) => a.gridTarget - b.gridTarget);
  }

  /* -------------------------------------------- */

  /**
   * Get the UVs array for a given texture name and scale correction.
   * @param {string} name                  Name of the texture we want to get UVs.
   * @param {number} [scaleCorrection=1]   The scale correction applied to UVs.
   * @returns {Float32Array}
   */
  static getTextureUVs(name, scaleCorrection=1) {
    if ( scaleCorrection === 1 ) return this.texturesData[name].UVs;
    const tUVs = this.texturesData[name].UVs;
    const c = this.texturesData[name].center;
    const UVs = new Float32Array(8);
    for ( let i=0; i<8; i+=2 ) {
      UVs[i] = ((tUVs[i] - c.x) * scaleCorrection) + c.x;
      UVs[i+1] = ((tUVs[i+1] - c.y) * scaleCorrection) + c.y;
    }
    return UVs;
  }

  /* -------------------------------------------- */

  /**
   * Get ring and background names for a given size.
   * @param {number} size   The size to match (grid size dimension)
   * @returns {{bkgName: string, ringName: string, colorBand: RingColorBand}}
   */
  static getRingDataBySize(size) {
    if ( !Number.isFinite(size) || !this.#ringData.length ) {
      return {
        ringName: undefined,
        bkgName: undefined,
        colorBand: undefined,
        defaultRingColorLittleEndian: null,
        defaultBackgroundColorLittleEndian: null,
        subjectScaleAdjustment: null
      };
    }
    const rings = this.#ringData.map(r => [Math.abs(r.gridTarget - size), r]);

    // Sort rings on proximity to target size
    rings.sort((a, b) => a[0] - b[0]);

    // Choose the closest ring, access the second element of the first array which is the ring data object
    const closestRing = rings[0][1];

    return {
      ringName: closestRing.ringName,
      bkgName: closestRing.bkgName,
      colorBand: closestRing.colorBand,
      defaultRingColorLittleEndian: closestRing.defaultRingColorLittleEndian,
      defaultBackgroundColorLittleEndian: closestRing.defaultBackgroundColorLittleEndian,
      subjectScaleAdjustment: closestRing.subjectScaleAdjustment
    };
  }

  /* -------------------------------------------- */
  /*  Attributes                                  */
  /* -------------------------------------------- */

  /** @type {string} */
  ringName;

  /** @type {string} */
  bkgName;

  /** @type {Float32Array} */
  ringUVs;

  /** @type {Float32Array} */
  bkgUVs;

  /** @type {number} */
  ringColorLittleEndian = 0xFFFFFF; // Little endian format => BBGGRR

  /** @type {number} */
  bkgColorLittleEndian = 0xFFFFFF; // Little endian format => BBGGRR

  /** @type {number|null} */
  defaultRingColorLittleEndian = null;

  /** @type {number|null} */
  defaultBackgroundColorLittleEndian = null;

  /** @type {number} */
  effects = 0;

  /** @type {number} */
  scaleCorrection = 1;

  /** @type {number} */
  scaleAdjustmentX = 1;

  /** @type {number} */
  scaleAdjustmentY = 1;

  /** @type {number} */
  subjectScaleAdjustment = 1;

  /** @type {number} */
  textureScaleAdjustment = 1;

  /** @type {RingColorBand} */
  colorBand;


  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Reference to the token that should be animated.
   * @type {Token|void}
   */
  get token() {
    return this.#token.deref();
  }

  /**
   * Weak reference to the token being animated.
   * @type {WeakRef<Token>}
   */
  #token;

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Configure the sprite mesh.
   * @param {PrimarySpriteMesh} [mesh]  The mesh to which TokenRing functionality is configured.
   */
  configure(mesh) {
    this.#configureTexture(mesh);
    this.configureSize();
    this.configureVisuals();
  }

  /* -------------------------------------------- */

  /**
   * Clear configuration pertaining to token ring from the mesh.
   */
  clear() {
    this.ringName = undefined;
    this.bkgName = undefined;
    this.ringUVs = undefined;
    this.bkgUVs = undefined;
    this.colorBand = undefined;
    this.ringColorLittleEndian = 0xFFFFFF;
    this.bkgColorLittleEndian = 0xFFFFFF;
    this.defaultRingColorLittleEndian = null;
    this.defaultBackgroundColorLittleEndian = null;
    this.scaleCorrection = 1;
    this.scaleAdjustmentX = 1;
    this.scaleAdjustmentY = 1;
    this.subjectScaleAdjustment = 1;
    this.textureScaleAdjustment = 1;
    const mesh = this.token.mesh;
    if ( mesh ) mesh.padding = 0;
  }

  /* -------------------------------------------- */

  /**
   * Configure token ring size.
   */
  configureSize() {
    const mesh = this.token.mesh;

    // Ring size
    const size = Math.min(this.token.document.width ?? 1, this.token.document.height ?? 1);
    Object.assign(this, this.constructor.getRingDataBySize(size));

    // Subject scale
    const scale = this.token.document.ring.subject.scale ?? this.scaleCorrection ?? 1;
    this.scaleCorrection = scale;
    this.ringUVs = this.constructor.getTextureUVs(this.ringName, scale);
    this.bkgUVs = this.constructor.getTextureUVs(this.bkgName, scale);

    // Determine the longer and shorter sides of the image
    const {width: w, height: h} = this.token.mesh.texture ?? this.token.texture;
    let longSide = Math.max(w, h);
    let shortSide = Math.min(w, h);

    // Calculate the necessary padding
    let padding = (longSide - shortSide) / 2;

    // Determine padding for x and y sides
    let paddingX = (w < h) ? padding : 0;
    let paddingY = (w > h) ? padding : 0;

    // Apply mesh padding
    mesh.paddingX = paddingX;
    mesh.paddingY = paddingY;

    // Apply adjustments
    const adjustment = shortSide / longSide;
    this.scaleAdjustmentX = paddingX ? adjustment : 1.0;
    this.scaleAdjustmentY = paddingY ? adjustment : 1.0;

    // Apply texture scale adjustment for token without a subject texture and in grid fit mode
    const inferred = (this.token.document.texture.src !== this.token.document._inferRingSubjectTexture());
    if ( CONFIG.Token.ring.isGridFitMode && !inferred && !this.token.document._source.ring.subject.texture ) {
      this.textureScaleAdjustment = this.subjectScaleAdjustment;
    }
    else this.textureScaleAdjustment = 1;
  }

  /* -------------------------------------------- */

  /**
   * Configure the token ring visuals properties.
   */
  configureVisuals() {
    const ring = this.token.document.ring;

    // Configure colors
    const colors = foundry.utils.mergeObject(ring.colors, this.token.getRingColors(), {inplace: false});
    const resolveColor = (color, defaultColor) => {
      const resolvedColor = Color.from(color ?? 0xFFFFFF).littleEndian;
      return ((resolvedColor === 0xFFFFFF) && (defaultColor !== null)) ? defaultColor : resolvedColor;
    };
    this.ringColorLittleEndian = resolveColor(colors?.ring, this.defaultRingColorLittleEndian);
    this.bkgColorLittleEndian = resolveColor(colors?.background, this.defaultBackgroundColorLittleEndian)

    // Configure effects
    const effectsToApply = this.token.getRingEffects();
    this.effects = ((ring.effects >= this.constructor.effects.DISABLED)
        ? ring.effects : this.constructor.effects.ENABLED)
      | effectsToApply.reduce((acc, e) => acc |= e, 0x0);

    // Mask with enabled effects for the current token ring configuration
    let mask = this.effects & CONFIG.Token.ring.ringClass.effects.ENABLED;
    for ( const key in CONFIG.Token.ring.effects ) {
      const v = CONFIG.Token.ring.ringClass.effects[key];
      if ( v !== undefined ) {
        mask |= v;
      }
    }
    this.effects &= mask;
  }

  /* -------------------------------------------- */

  /**
   * Configure dynamic token ring subject texture.
   * @param {PrimarySpriteMesh} mesh                  The mesh being configured
   */
  #configureTexture(mesh) {
    const src = this.token.document.ring.subject.texture;
    if ( PIXI.Assets.cache.has(src) ) {
      const subjectTexture = getTexture(src);
      if ( subjectTexture?.valid ) mesh.texture = subjectTexture;
    }
  }

  /* -------------------------------------------- */
  /*  Animations                                  */
  /* -------------------------------------------- */

  /**
   * Flash the ring briefly with a certain color.
   * @param {Color} color                              Color to flash.
   * @param {CanvasAnimationOptions} animationOptions  Options to customize the animation.
   * @returns {Promise<boolean|void>}
   */
  async flashColor(color, animationOptions={}) {
    if ( Number.isNaN(color) ) return;
    const defaultColorFallback = this.token.ring.defaultRingColorLittleEndian ?? 0xFFFFFF;
    const configuredColor = Color.from(foundry.utils.mergeObject(
      this.token.document.ring.colors,
      this.token.getRingColors(),
      {inplace: false}
    ).ring);
    const originalColor = configuredColor.valid ? configuredColor.littleEndian : defaultColorFallback;
    return await CanvasAnimation.animate([{
      attribute: "ringColorLittleEndian",
      parent: this,
      from: originalColor,
      to: new Color(color.littleEndian),
      color: true
    }], foundry.utils.mergeObject({
      duration: 1600,
      priority: PIXI.UPDATE_PRIORITY.HIGH,
      easing: this.constructor.createSpikeEasing(.15)
    }, animationOptions));
  }

  /* -------------------------------------------- */

  /**
   * Create an easing function that spikes in the center. Ideal duration is around 1600ms.
   * @param {number} [spikePct=0.5]  Position on [0,1] where the spike occurs.
   * @returns {Function(number): number}
   */
  static createSpikeEasing(spikePct=0.5) {
    const scaleStart = 1 / spikePct;
    const scaleEnd = 1 / (1 - spikePct);
    return pt => {
      if ( pt < spikePct ) return CanvasAnimation.easeInCircle(pt * scaleStart);
      else return 1 - CanvasAnimation.easeOutCircle(((pt - spikePct) * scaleEnd));
    };
  }

  /* -------------------------------------------- */

  /**
   * Easing function that produces two peaks before returning to the original value. Ideal duration is around 500ms.
   * @param {number} pt     The proportional animation timing on [0,1].
   * @returns {number}      The eased animation progress on [0,1].
   */
  static easeTwoPeaks(pt) {
    return (Math.sin((4 * Math.PI * pt) - (Math.PI / 2)) + 1) / 2;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * To avoid breaking dnd5e.
   * @deprecated since v12
   * @ignore
   */
  configureMesh() {}

  /**
   * To avoid breaking dnd5e.
   * @deprecated since v12
   * @ignore
   */
  configureNames() {}

}
