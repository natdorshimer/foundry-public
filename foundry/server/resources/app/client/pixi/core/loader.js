/**
 * A Loader class which helps with loading video and image textures.
 */
class TextureLoader {

  /**
   * The duration in milliseconds for which a texture will remain cached
   * @type {number}
   */
  static CACHE_TTL = 1000 * 60 * 15;

  /**
   * Record the timestamps when each asset path is retrieved from cache.
   * @type {Map<PIXI.BaseTexture|PIXI.Spritesheet,{src:string,time:number}>}
   */
  static #cacheTime = new Map();

  /**
   * A mapping of cached texture data
   * @type {WeakMap<PIXI.BaseTexture,Map<string, TextureAlphaData>>}
   */
  static #textureDataMap = new WeakMap();

  /**
   * Create a fixed retry string to use for CORS retries.
   * @type {string}
   */
  static #retryString = Date.now().toString();

  /**
   * To know if the basis transcoder has been initialized
   * @type {boolean}
   */
  static #basisTranscoderInitialized = false;

  /* -------------------------------------------- */

  /**
   * Initialize the basis transcoder for PIXI.Assets
   * @returns {Promise<*>}
   */
  static async initializeBasisTranscoder() {
    if ( this.#basisTranscoderInitialized ) return;
    this.#basisTranscoderInitialized = true;
    return await PIXI.TranscoderWorker.loadTranscoder(
      "scripts/basis_transcoder.js",
      "scripts/basis_transcoder.wasm"
    );
  }

  /* -------------------------------------------- */

  /**
   * Check if a source has a text file extension.
   * @param {string} src          The source.
   * @returns {boolean}           If the source has a text extension or not.
   */
  static hasTextExtension(src) {
    let rgx = new RegExp(`(\\.${Object.keys(CONST.TEXT_FILE_EXTENSIONS).join("|\\.")})(\\?.*)?`, "i");
    return rgx.test(src);
  }

  /* -------------------------------------------- */

  /**
   * @typedef {Object} TextureAlphaData
   * @property {number} width         The width of the (downscaled) texture.
   * @property {number} height        The height of the (downscaled) texture.
   * @property {number} minX          The minimum x-coordinate with alpha > 0.
   * @property {number} minY          The minimum y-coordinate with alpha > 0.
   * @property {number} maxX          The maximum x-coordinate with alpha > 0 plus 1.
   * @property {number} maxY          The maximum y-coordinate with alpha > 0 plus 1.
   * @property {Uint8Array} data      The array containing the texture alpha values (0-255)
   *                                  with the dimensions (maxX-minX)×(maxY-minY).
   */

  /**
   * Use the texture to create a cached mapping of pixel alpha and cache it.
   * Cache the bounding box of non-transparent pixels for the un-rotated shape.
   * @param {PIXI.Texture} texture                The provided texture.
   * @param {number} [resolution=1]               Resolution of the texture data output.
   * @returns {TextureAlphaData|undefined}        The texture data if the texture is valid, else undefined.
   */
  static getTextureAlphaData(texture, resolution=1) {

    // If texture is not present
    if ( !texture?.valid ) return;

    // Get the base tex and the stringified frame + width/height
    const width = Math.ceil(Math.round(texture.width * texture.resolution) * resolution);
    const height = Math.ceil(Math.round(texture.height * texture.resolution) * resolution);
    const baseTex = texture.baseTexture;
    const frame = texture.frame;
    const sframe = `${frame.x},${frame.y},${frame.width},${frame.height},${width},${height}`;

    // Get frameDataMap and textureData if they exist
    let textureData;
    let frameDataMap = this.#textureDataMap.get(baseTex);
    if ( frameDataMap ) textureData = frameDataMap.get(sframe);

    // If texture data exists for the baseTex/frame couple, we return it
    if ( textureData ) return textureData;
    else textureData = {};

    // Create a temporary Sprite using the provided texture
    const sprite = new PIXI.Sprite(texture);
    sprite.width = textureData.width = width;
    sprite.height = textureData.height = height;
    sprite.anchor.set(0, 0);

    // Create or update the alphaMap render texture
    const tex = PIXI.RenderTexture.create({width: width, height: height});
    canvas.app.renderer.render(sprite, {renderTexture: tex});
    sprite.destroy(false);
    const pixels = canvas.app.renderer.extract.pixels(tex);
    tex.destroy(true);

    // Trim pixels with zero alpha
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for ( let i = 3, y = 0; y < height; y++ ) {
      for ( let x = 0; x < width; x++, i += 4 ) {
        const alpha = pixels[i];
        if ( alpha === 0 ) continue;
        if ( x < minX ) minX = x;
        if ( x >= maxX ) maxX = x + 1;
        if ( y < minY ) minY = y;
        if ( y >= maxY ) maxY = y + 1;
      }
    }

    // Special case when the whole texture is alpha 0
    if ( minX > maxX ) minX = minY = maxX = maxY = 0;

    // Set the bounds of the trimmed region
    textureData.minX = minX;
    textureData.minY = minY;
    textureData.maxX = maxX;
    textureData.maxY = maxY;

    // Create new buffer for storing the alpha channel only
    const data = textureData.data = new Uint8Array((maxX - minX) * (maxY - minY));
    for ( let i = 0, y = minY; y < maxY; y++ ) {
      for ( let x = minX; x < maxX; x++, i++ ) {
        data[i] = pixels[(((width * y) + x) * 4) + 3];
      }
    }

    // Saving the texture data
    if ( !frameDataMap ) {
      frameDataMap = new Map();
      this.#textureDataMap.set(baseTex, frameDataMap);
    }
    frameDataMap.set(sframe, textureData);
    return textureData;
  }

  /* -------------------------------------------- */

  /**
   * Load all the textures which are required for a particular Scene
   * @param {Scene} scene                                 The Scene to load
   * @param {object} [options={}]                         Additional options that configure texture loading
   * @param {boolean} [options.expireCache=true]          Destroy other expired textures
   * @param {boolean} [options.additionalSources=[]]      Additional sources to load during canvas initialize
   * @param {number} [options.maxConcurrent]              The maximum number of textures that can be loaded concurrently
   * @returns {Promise<void[]>}
   */
  static loadSceneTextures(scene, {expireCache=true, additionalSources=[], maxConcurrent}={}) {
    let toLoad = [];

    // Scene background and foreground textures
    if ( scene.background.src ) toLoad.push(scene.background.src);
    if ( scene.foreground ) toLoad.push(scene.foreground);
    if ( scene.fog.overlay ) toLoad.push(scene.fog.overlay);

    // Tiles
    toLoad = toLoad.concat(scene.tiles.reduce((arr, t) => {
      if ( t.texture.src ) arr.push(t.texture.src);
      return arr;
    }, []));

    // Tokens
    toLoad.push(CONFIG.Token.ring.spritesheet);
    toLoad = toLoad.concat(scene.tokens.reduce((arr, t) => {
      if ( t.texture.src ) arr.push(t.texture.src);
      if ( t.ring.enabled ) arr.push(t.ring.subject.texture);
      return arr;
    }, []));

    // Control Icons
    toLoad = toLoad.concat(Object.values(CONFIG.controlIcons));

    // Status Effect textures
    toLoad = toLoad.concat(CONFIG.statusEffects.map(e => e.img ?? /** @deprecated since v12 */ e.icon));

    // Configured scene textures
    toLoad.push(...Object.values(canvas.sceneTextures));

    // Additional requested sources
    toLoad.push(...additionalSources);

    // Load files
    const showName = scene.active || scene.visible;
    const loadName = showName ? (scene.navName || scene.name) : "...";
    return this.loader.load(toLoad, {
      message: game.i18n.format("SCENES.Loading", {name: loadName}),
      expireCache,
      maxConcurrent
    });
  }

  /* -------------------------------------------- */

  /**
   * Load an Array of provided source URL paths
   * @param {string[]} sources      The source URLs to load
   * @param {object} [options={}]   Additional options which modify loading
   * @param {string} [options.message]              The status message to display in the load bar
   * @param {boolean} [options.expireCache=false]   Expire other cached textures?
   * @param {number} [options.maxConcurrent]        The maximum number of textures that can be loaded concurrently.
   * @param {boolean} [options.displayProgress]     Display loading progress bar
   * @returns {Promise<void[]>}     A Promise which resolves once all textures are loaded
   */
  async load(sources, {message, expireCache=false, maxConcurrent, displayProgress=true}={}) {
    sources = new Set(sources);
    const progress = {message: message, loaded: 0, failed: 0, total: sources.size, pct: 0};
    console.groupCollapsed(`${vtt} | Loading ${sources.size} Assets`);
    const loadTexture = async src => {
      try {
        await this.loadTexture(src);
        if ( displayProgress ) TextureLoader.#onProgress(src, progress);
      } catch(err) {
        TextureLoader.#onError(src, progress, err);
      }
    };
    const promises = [];
    if ( maxConcurrent ) {
      const semaphore = new foundry.utils.Semaphore(maxConcurrent);
      for ( const src of sources ) promises.push(semaphore.add(loadTexture, src));
    } else {
      for ( const src of sources ) promises.push(loadTexture(src));
    }
    await Promise.allSettled(promises);
    console.groupEnd();
    if ( expireCache ) await this.expireCache();
  }

  /* -------------------------------------------- */

  /**
   * Load a single texture or spritesheet on-demand from a given source URL path
   * @param {string} src                                          The source texture path to load
   * @returns {Promise<PIXI.BaseTexture|PIXI.Spritesheet|null>}   The loaded texture object
   */
  async loadTexture(src) {
    const loadAsset = async (src, bustCache=false) => {
      if ( bustCache ) src = TextureLoader.getCacheBustURL(src);
      if ( !src ) return null;
      try {
        return await PIXI.Assets.load(src);
      } catch ( err ) {
        if ( bustCache ) throw err;
        return await loadAsset(src, true);
      }
    };
    let asset = await loadAsset(src);
    if ( !asset?.baseTexture?.valid ) return null;
    if ( asset instanceof PIXI.Texture ) asset = asset.baseTexture;
    this.setCache(src, asset);
    return asset;
  }

  /* --------------------------------------------- */

  /**
   * Use the Fetch API to retrieve a resource and return a Blob instance for it.
   * @param {string} src
   * @param {object} [options]                   Options to configure the loading behaviour.
   * @param {boolean} [options.bustCache=false]  Append a cache-busting query parameter to the request.
   * @returns {Promise<Blob>}                    A Blob containing the loaded data
   */
  static async fetchResource(src, {bustCache=false}={}) {
    const fail = `Failed to load texture ${src}`;
    const req = bustCache ? TextureLoader.getCacheBustURL(src) : src;
    if ( !req ) throw new Error(`${fail}: Invalid URL`);
    let res;
    try {
      res = await fetch(req, {mode: "cors", credentials: "same-origin"});
    } catch(err) {
      // We may have encountered a common CORS limitation: https://bugs.chromium.org/p/chromium/issues/detail?id=409090
      if ( !bustCache ) return this.fetchResource(src, {bustCache: true});
      throw new Error(`${fail}: CORS failure`);
    }
    if ( !res.ok ) throw new Error(`${fail}: Server responded with ${res.status}`);
    return res.blob();
  }

  /* -------------------------------------------- */

  /**
   * Log texture loading progress in the console and in the Scene loading bar
   * @param {string} src          The source URL being loaded
   * @param {object} progress     Loading progress
   * @private
   */
  static #onProgress(src, progress) {
    progress.loaded++;
    progress.pct = Math.round((progress.loaded + progress.failed) * 100 / progress.total);
    SceneNavigation.displayProgressBar({label: progress.message, pct: progress.pct});
    console.log(`Loaded ${src} (${progress.pct}%)`);
  }

  /* -------------------------------------------- */

  /**
   * Log failed texture loading
   * @param {string} src          The source URL being loaded
   * @param {object} progress     Loading progress
   * @param {Error} error         The error which occurred
   * @private
   */
  static #onError(src, progress, error) {
    progress.failed++;
    progress.pct = Math.round((progress.loaded + progress.failed) * 100 / progress.total);
    SceneNavigation.displayProgressBar({label: progress.message, pct: progress.pct});
    console.warn(`Loading failed for ${src} (${progress.pct}%): ${error.message}`);
  }

  /* -------------------------------------------- */
  /*  Cache Controls                              */
  /* -------------------------------------------- */

  /**
   * Add an image or a sprite sheet url to the assets cache.
   * @param {string} src                                 The source URL.
   * @param {PIXI.BaseTexture|PIXI.Spritesheet} asset    The asset
   */
  setCache(src, asset) {
    TextureLoader.#cacheTime.set(asset, {src, time: Date.now()});
  }

  /* -------------------------------------------- */

  /**
   * Retrieve a texture or a sprite sheet from the assets cache
   * @param {string} src                                     The source URL
   * @returns {PIXI.BaseTexture|PIXI.Spritesheet|null}       The cached texture, a sprite sheet or undefined
   */
  getCache(src) {
    if ( !src ) return null;
    if ( !PIXI.Assets.cache.has(src) ) src = TextureLoader.getCacheBustURL(src) || src;
    let asset = PIXI.Assets.get(src);
    if ( !asset?.baseTexture?.valid ) return null;
    if ( asset instanceof PIXI.Texture ) asset = asset.baseTexture;
    this.setCache(src, asset);
    return asset;
  }

  /* -------------------------------------------- */

  /**
   * Expire and unload assets from the cache which have not been used for more than CACHE_TTL milliseconds.
   */
  async expireCache() {
    const promises = [];
    const t = Date.now();
    for ( const [asset, {src, time}] of TextureLoader.#cacheTime.entries() ) {
      const baseTexture = asset instanceof PIXI.Spritesheet ? asset.baseTexture : asset;
      if ( !baseTexture || baseTexture.destroyed ) {
        TextureLoader.#cacheTime.delete(asset);
        continue;
      }
      if ( (t - time) <= TextureLoader.CACHE_TTL ) continue;
      console.log(`${vtt} | Expiring cached texture: ${src}`);
      promises.push(PIXI.Assets.unload(src));
      TextureLoader.#cacheTime.delete(asset);
    }
    await Promise.allSettled(promises);
  }

  /* -------------------------------------------- */

  /**
   * Return a URL with a cache-busting query parameter appended.
   * @param {string} src        The source URL being attempted
   * @returns {string|boolean}  The new URL, or false on a failure.
   */
  static getCacheBustURL(src) {
    const url = URL.parseSafe(src);
    if ( !url ) return false;
    if ( url.origin === window.location.origin ) return false;
    url.searchParams.append("cors-retry", TextureLoader.#retryString);
    return url.href;
  }

  /* -------------------------------------------- */
  /*  Deprecations                                */
  /* -------------------------------------------- */

  /**
   * @deprecated since v11
   * @ignore
   */
  async loadImageTexture(src) {
    const warning = "TextureLoader#loadImageTexture is deprecated. Use TextureLoader#loadTexture instead.";
    foundry.utils.logCompatibilityWarning(warning, {since: 11, until: 13});
    return this.loadTexture(src);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v11
   * @ignore
   */
  async loadVideoTexture(src) {
    const warning = "TextureLoader#loadVideoTexture is deprecated. Use TextureLoader#loadTexture instead.";
    foundry.utils.logCompatibilityWarning(warning, {since: 11, until: 13});
    return this.loadTexture(src);
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  static get textureBufferDataMap() {
    const warning = "TextureLoader.textureBufferDataMap is deprecated without replacement. Use " +
      "TextureLoader.getTextureAlphaData to create a texture data map and cache it automatically, or create your own" +
      " caching system.";
    foundry.utils.logCompatibilityWarning(warning, {since: 12, until: 14});
    return this.#textureBufferDataMap;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  static #textureBufferDataMap = new Map();
}

/**
 * A global reference to the singleton texture loader
 * @type {TextureLoader}
 */
TextureLoader.loader = new TextureLoader();


/* -------------------------------------------- */


/**
 * Test whether a file source exists by performing a HEAD request against it
 * @param {string} src          The source URL or path to test
 * @returns {Promise<boolean>}   Does the file exist at the provided url?
 */
async function srcExists(src) {
  return foundry.utils.fetchWithTimeout(src, { method: "HEAD" }).then(resp => {
    return resp.status < 400;
  }).catch(() => false);
}


/* -------------------------------------------- */


/**
 * Get a single texture or sprite sheet from the cache.
 * @param {string} src                            The texture path to load.
 * @returns {PIXI.Texture|PIXI.Spritesheet|null}  A texture, a sprite sheet or null if not found in cache.
 */
function getTexture(src) {
  const asset = TextureLoader.loader.getCache(src);
  const baseTexture = asset instanceof PIXI.Spritesheet ? asset.baseTexture : asset;
  if ( !baseTexture?.valid ) return null;
  return (asset instanceof PIXI.Spritesheet ? asset : new PIXI.Texture(asset));
}


/* -------------------------------------------- */


/**
 * Load a single asset and return a Promise which resolves once the asset is ready to use
 * @param {string} src                           The requested asset source
 * @param {object} [options]                     Additional options which modify asset loading
 * @param {string} [options.fallback]            A fallback texture URL to use if the requested source is unavailable
 * @returns {PIXI.Texture|PIXI.Spritesheet|null} The loaded Texture or sprite sheet,
 *                                               or null if loading failed with no fallback
 */
async function loadTexture(src, {fallback}={}) {
  let asset;
  let error;
  try {
    asset = await TextureLoader.loader.loadTexture(src);
    const baseTexture = asset instanceof PIXI.Spritesheet ? asset.baseTexture : asset;
    if ( !baseTexture?.valid ) error = new Error(`Invalid Asset ${src}`);
  }
  catch(err) {
    err.message = `The requested asset ${src} could not be loaded: ${err.message}`;
    error = err;
  }
  if ( error ) {
    console.error(error);
    if ( TextureLoader.hasTextExtension(src) ) return null; // No fallback for spritesheets
    return fallback ? loadTexture(fallback) : null;
  }
  if ( asset instanceof PIXI.Spritesheet ) return asset;
  return new PIXI.Texture(asset);
}
