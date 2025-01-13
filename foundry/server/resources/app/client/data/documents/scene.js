/**
 * The client-side Scene document which extends the common BaseScene model.
 * @extends foundry.documents.BaseItem
 * @mixes ClientDocumentMixin
 *
 * @see {@link Scenes}            The world-level collection of Scene documents
 * @see {@link SceneConfig}       The Scene configuration application
 */
class Scene extends ClientDocumentMixin(foundry.documents.BaseScene) {

  /**
   * Track the viewed position of each scene (while in memory only, not persisted)
   * When switching back to a previously viewed scene, we can automatically pan to the previous position.
   * @type {CanvasViewPosition}
   */
  _viewPosition = {};

  /**
   * Track whether the scene is the active view
   * @type {boolean}
   */
  _view = this.active;

  /**
   * The grid instance.
   * @type {foundry.grid.BaseGrid}
   */
  grid = this.grid; // Workaround for subclass property instantiation issue.

  /**
   * Determine the canvas dimensions this Scene would occupy, if rendered
   * @type {object}
   */
  dimensions = this.dimensions; // Workaround for subclass property instantiation issue.

  /* -------------------------------------------- */
  /*  Scene Properties                            */
  /* -------------------------------------------- */

  /**
   * Provide a thumbnail image path used to represent this document.
   * @type {string}
   */
  get thumbnail() {
    return this.thumb;
  }

  /* -------------------------------------------- */

  /**
   * A convenience accessor for whether the Scene is currently viewed
   * @type {boolean}
   */
  get isView() {
    return this._view;
  }

  /* -------------------------------------------- */
  /*  Scene Methods                               */
  /* -------------------------------------------- */

  /**
   * Set this scene as currently active
   * @returns {Promise<Scene>}  A Promise which resolves to the current scene once it has been successfully activated
   */
  async activate() {
    if ( this.active ) return this;
    return this.update({active: true});
  }

  /* -------------------------------------------- */

  /**
   * Set this scene as the current view
   * @returns {Promise<Scene>}
   */
  async view() {

    // Do not switch if the loader is still running
    if ( canvas.loading ) {
      return ui.notifications.warn("You cannot switch Scenes until resources finish loading for your current view.");
    }

    // Switch the viewed scene
    for ( let scene of game.scenes ) {
      scene._view = scene.id === this.id;
    }

    // Notify the user in no-canvas mode
    if ( game.settings.get("core", "noCanvas") ) {
      ui.notifications.info(game.i18n.format("INFO.SceneViewCanvasDisabled", {
        name: this.navName ? this.navName : this.name
      }));
    }

    // Re-draw the canvas if the view is different
    if ( canvas.initialized && (canvas.id !== this.id) ) {
      console.log(`Foundry VTT | Viewing Scene ${this.name}`);
      await canvas.draw(this);
    }

    // Render apps for the collection
    this.collection.render();
    ui.combat.initialize();
    return this;
  }

  /* -------------------------------------------- */

  /** @override */
  clone(createData={}, options={}) {
    createData.active = false;
    createData.navigation = false;
    if ( !foundry.data.validators.isBase64Data(createData.thumb) ) delete createData.thumb;
    if ( !options.save ) return super.clone(createData, options);
    return this.createThumbnail().then(data => {
      createData.thumb = data.thumb;
      return super.clone(createData, options);
    });
  }

  /* -------------------------------------------- */

  /** @override */
  reset() {
    this._initialize({sceneReset: true});
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  toObject(source=true) {
    const object = super.toObject(source);
    if ( !source && this.grid.isHexagonal && this.flags.core?.legacyHex ) {
      object.grid.size = Math.round(this.grid.size * (2 * Math.SQRT1_3));
    }
    return object;
  }


  /* -------------------------------------------- */

  /** @inheritdoc */
  prepareBaseData() {
    this.grid = Scene.#getGrid(this);
    this.dimensions = this.getDimensions();
    this.playlistSound = this.playlist ? this.playlist.sounds.get(this._source.playlistSound) : null;
    // A temporary assumption until a more robust long-term solution when we implement Scene Levels.
    this.foregroundElevation = this.foregroundElevation || (this.grid.distance * 4);
  }

  /* -------------------------------------------- */

  /**
   * Create the grid instance from the grid config of this scene if it doesn't exist yet.
   * @param {Scene} scene
   * @returns {foundry.grid.BaseGrid}
   */
  static #getGrid(scene) {
    const grid = scene.grid;
    if ( grid instanceof foundry.grid.BaseGrid ) return grid;

    const T = CONST.GRID_TYPES;
    const type = grid.type;
    const config = {
      size: grid.size,
      distance: grid.distance,
      units: grid.units,
      style: grid.style,
      thickness: grid.thickness,
      color: grid.color,
      alpha: grid.alpha
    };

    // Gridless grid
    if ( type === T.GRIDLESS ) return new foundry.grid.GridlessGrid(config);

    // Square grid
    if ( type === T.SQUARE ) {
      config.diagonals = game.settings.get("core", "gridDiagonals");
      return new foundry.grid.SquareGrid(config);
    }

    // Hexagonal grid
    if ( type.between(T.HEXODDR, T.HEXEVENQ) ) {
      config.columns = (type === T.HEXODDQ) || (type === T.HEXEVENQ);
      config.even = (type === T.HEXEVENR) || (type === T.HEXEVENQ);
      if ( scene.flags.core?.legacyHex ) config.size *= (Math.SQRT3 / 2);
      return new foundry.grid.HexagonalGrid(config);
    }

    throw new Error("Invalid grid type");
  }

  /* -------------------------------------------- */

  /**
   * @typedef {object} SceneDimensions
   * @property {number} width        The width of the canvas.
   * @property {number} height       The height of the canvas.
   * @property {number} size         The grid size.
   * @property {Rectangle} rect      The canvas rectangle.
   * @property {number} sceneX       The X coordinate of the scene rectangle within the larger canvas.
   * @property {number} sceneY       The Y coordinate of the scene rectangle within the larger canvas.
   * @property {number} sceneWidth   The width of the scene.
   * @property {number} sceneHeight  The height of the scene.
   * @property {Rectangle} sceneRect The scene rectangle.
   * @property {number} distance     The number of distance units in a single grid space.
   * @property {number} distancePixels  The factor to convert distance units to pixels.
   * @property {string} units        The units of distance.
   * @property {number} ratio        The aspect ratio of the scene rectangle.
   * @property {number} maxR         The length of the longest line that can be drawn on the canvas.
   * @property {number} rows         The number of grid rows on the canvas.
   * @property {number} columns      The number of grid columns on the canvas.
   */

  /**
   * Get the Canvas dimensions which would be used to display this Scene.
   * Apply padding to enlarge the playable space and round to the nearest 2x grid size to ensure symmetry.
   * The rounding accomplishes that the padding buffer around the map always contains whole grid spaces.
   * @returns {SceneDimensions}
   */
  getDimensions() {

    // Get Scene data
    const grid = this.grid;
    const sceneWidth = this.width;
    const sceneHeight = this.height;

    // Compute the correct grid sizing
    let dimensions;
    if ( grid.isHexagonal && this.flags.core?.legacyHex ) {
      const legacySize = Math.round(grid.size * (2 * Math.SQRT1_3));
      dimensions = foundry.grid.HexagonalGrid._calculatePreV10Dimensions(grid.columns, legacySize,
        sceneWidth, sceneHeight, this.padding);
    } else {
      dimensions = grid.calculateDimensions(sceneWidth, sceneHeight, this.padding);
    }
    const {width, height} = dimensions;
    const sceneX = dimensions.x - this.background.offsetX;
    const sceneY = dimensions.y - this.background.offsetY;

    // Define Scene dimensions
    return {
      width, height, size: grid.size,
      rect: {x: 0, y: 0, width, height},
      sceneX, sceneY, sceneWidth, sceneHeight,
      sceneRect: {x: sceneX, y: sceneY, width: sceneWidth, height: sceneHeight},
      distance: grid.distance,
      distancePixels: grid.size / grid.distance,
      ratio: sceneWidth / sceneHeight,
      maxR: Math.hypot(width, height),
      rows: dimensions.rows,
      columns: dimensions.columns
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onClickDocumentLink(event) {
    if ( this.journal ) return this.journal._onClickDocumentLink(event);
    return super._onClickDocumentLink(event);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;

    // Create a base64 thumbnail for the scene
    if ( !("thumb" in data) && canvas.ready && this.background.src ) {
      const t = await this.createThumbnail({img: this.background.src});
      this.updateSource({thumb: t.thumb});
    }

    // Trigger Playlist Updates
    if ( this.active ) return game.playlists._onChangeScene(this, data);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  static async _preCreateOperation(documents, operation, user) {
    // Set a scene as active if none currently are.
    if ( !game.scenes.active ) {
      const candidate = documents.find((s, i) => !("active" in operation.data[i]));
      candidate?.updateSource({ active: true });
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);

    // Trigger Region Behavior status events
    const user = game.users.get(userId);
    for ( const region of this.regions ) {
      region._handleEvent({
        name: CONST.REGION_EVENTS.BEHAVIOR_STATUS,
        data: {active: true},
        region,
        user
      });
    }

    if ( data.active === true ) this._onActivate(true);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if ( allowed === false ) return false;

    // Handle darkness level lock special case
    if ( changed.environment?.darknessLevel !== undefined ) {
      const darknessLocked = this.environment.darknessLock && (changed.environment.darknessLock !== false);
      if ( darknessLocked ) delete changed.environment.darknessLevel;
    }

    if ( "thumb" in changed ) {
      options.thumb ??= [];
      options.thumb.push(this.id);
    }

    // If the canvas size has changed, translate the placeable objects
    if ( options.autoReposition ) {
      try {
        changed = this._repositionObjects(changed);
      }
      catch (err) {
        delete changed.width;
        delete changed.height;
        delete changed.padding;
        delete changed.background;
        return ui.notifications.error(err.message);
      }
    }

    const audioChange = ("active" in changed) || (this.active && ["playlist", "playlistSound"].some(k => k in changed));
    if ( audioChange ) return game.playlists._onChangeScene(this, changed);
  }

  /* -------------------------------------------- */

  /**
   * Handle repositioning of placed objects when the Scene dimensions change
   * @private
   */
  _repositionObjects(sceneUpdateData) {
    const translationScaleX = "width" in sceneUpdateData ? (sceneUpdateData.width / this.width) : 1;
    const translationScaleY = "height" in sceneUpdateData ? (sceneUpdateData.height / this.height) : 1;
    const averageTranslationScale = (translationScaleX + translationScaleY) / 2;

    // If the padding is larger than before, we need to add to it. If it's smaller, we need to subtract from it.
    const originalDimensions = this.getDimensions();
    const updatedScene = this.clone();
    updatedScene.updateSource(sceneUpdateData);
    const newDimensions = updatedScene.getDimensions();
    const paddingOffsetX = "padding" in sceneUpdateData ? ((newDimensions.width - originalDimensions.width) / 2) : 0;
    const paddingOffsetY = "padding" in sceneUpdateData ? ((newDimensions.height - originalDimensions.height) / 2) : 0;

    // Adjust for the background offset
    const backgroundOffsetX = sceneUpdateData.background?.offsetX !== undefined ? (this.background.offsetX - sceneUpdateData.background.offsetX) : 0;
    const backgroundOffsetY = sceneUpdateData.background?.offsetY !== undefined ? (this.background.offsetY - sceneUpdateData.background.offsetY) : 0;

    // If not gridless and grid size is not already being updated, adjust the grid size, ensuring the minimum
    if ( (this.grid.type !== CONST.GRID_TYPES.GRIDLESS) && !foundry.utils.hasProperty(sceneUpdateData, "grid.size") ) {
      const gridSize = Math.round(this._source.grid.size * averageTranslationScale);
      if ( gridSize < CONST.GRID_MIN_SIZE ) throw new Error(game.i18n.localize("SCENES.GridSizeError"));
      foundry.utils.setProperty(sceneUpdateData, "grid.size", gridSize);
    }

    function adjustPoint(x, y, applyOffset = true) {
      return {
        x: Math.round(x * translationScaleX + (applyOffset ? paddingOffsetX + backgroundOffsetX: 0) ),
        y: Math.round(y * translationScaleY + (applyOffset ? paddingOffsetY + backgroundOffsetY: 0) )
      }
    }

    // Placeables that have just a Position
    for ( let collection of ["tokens", "lights", "sounds", "templates"] ) {
      sceneUpdateData[collection] = this[collection].map(p => {
        const {x, y} = adjustPoint(p.x, p.y);
        return {_id: p.id, x, y};
      });
    }

    // Placeables that have a Position and a Size
    for ( let collection of ["tiles"] ) {
      sceneUpdateData[collection] = this[collection].map(p => {
        const {x, y} = adjustPoint(p.x, p.y);
        const width = Math.round(p.width * translationScaleX);
        const height = Math.round(p.height * translationScaleY);
        return {_id: p.id, x, y, width, height};
      });
    }

    // Notes have both a position and an icon size
    sceneUpdateData["notes"] = this.notes.map(p => {
      const {x, y} = adjustPoint(p.x, p.y);
      const iconSize = Math.max(32, Math.round(p.iconSize * averageTranslationScale));
      return {_id: p.id, x, y, iconSize};
    });

    // Drawings possibly have relative shape points
    sceneUpdateData["drawings"] = this.drawings.map(p => {
      const {x, y} = adjustPoint(p.x, p.y);
      const width = Math.round(p.shape.width * translationScaleX);
      const height = Math.round(p.shape.height * translationScaleY);
      let points = [];
      if ( p.shape.points ) {
        for ( let i = 0; i < p.shape.points.length; i += 2 ) {
          const {x, y} = adjustPoint(p.shape.points[i], p.shape.points[i+1], false);
          points.push(x);
          points.push(y);
        }
      }
      return {_id: p.id, x, y, "shape.width": width, "shape.height": height, "shape.points": points};
    });

    // Walls are two points
    sceneUpdateData["walls"] = this.walls.map(w => {
      const c = w.c;
      const p1 = adjustPoint(c[0], c[1]);
      const p2 = adjustPoint(c[2], c[3]);
      return {_id: w.id, c: [p1.x, p1.y, p2.x, p2.y]};
    });

    return sceneUpdateData;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    if ( !("thumb" in changed) && (options.thumb ?? []).includes(this.id) ) changed.thumb = this.thumb;
    super._onUpdate(changed, options, userId);
    const changedKeys = new Set(Object.keys(foundry.utils.flattenObject(changed)).filter(k => k !== "_id"));

    // If the Scene became active, go through the full activation procedure
    if ( ("active" in changed) ) this._onActivate(changed.active);

    // If the Thumbnail was updated, bust the image cache
    if ( ("thumb" in changed) && this.thumb ) {
      this.thumb = `${this.thumb.split("?")[0]}?${Date.now()}`;
    }

    // Update the Regions the Token is in
    if ( (game.user.id === userId) && ["grid.type", "grid.size"].some(k => changedKeys.has(k)) ) {
      // noinspection ES6MissingAwait
      RegionDocument._updateTokens(this.regions.contents, {reset: false});
    }

    // If the scene is already active, maybe re-draw the canvas
    if ( canvas.scene === this ) {
      const redraw = [
        "foreground", "fog.overlay", "width", "height", "padding",                // Scene Dimensions
        "grid.type", "grid.size", "grid.distance", "grid.units",                  // Grid Configuration
        "drawings", "lights", "sounds", "templates", "tiles", "tokens", "walls",  // Placeable Objects
        "weather"                                                                 // Ambience
      ];
      if ( redraw.some(k => changedKeys.has(k)) || ("background" in changed) ) return canvas.draw();

      // Update grid mesh
      if ( "grid" in changed ) canvas.interface.grid.initializeMesh(this.grid);

      // Modify vision conditions
      const perceptionAttrs = ["globalLight", "tokenVision", "fog.exploration"];
      if ( perceptionAttrs.some(k => changedKeys.has(k)) ) canvas.perception.initialize();
      if ( "tokenVision" in changed ) {
        for ( const token of canvas.tokens.placeables ) token.initializeVisionSource();
      }

      // Progress darkness level
      if ( changedKeys.has("environment.darknessLevel") && options.animateDarkness ) {
        return canvas.effects.animateDarkness(changed.environment.darknessLevel, {
          duration: typeof options.animateDarkness === "number" ? options.animateDarkness : undefined
        });
      }

      // Initialize the color manager with the new darkness level and/or scene background color
      if ( ("environment" in changed)
        || ["backgroundColor", "fog.colors.unexplored", "fog.colors.explored"].some(k => changedKeys.has(k)) ) {
        canvas.environment.initialize();
      }

      // New initial view position
      if ( ["initial.x", "initial.y", "initial.scale", "width", "height"].some(k => changedKeys.has(k)) ) {
        this._viewPosition = {};
        canvas.initializeCanvasPosition();
      }

      /**
       * @type {SceneConfig}
       */
      const sheet = this.sheet;
      if ( changedKeys.has("environment.darknessLock") ) {
        // Initialize controls with a darkness lock update
        if ( ui.controls.rendered ) ui.controls.initialize();
        // Update live preview if the sheet is rendered (force all)
        if ( sheet?.rendered ) sheet._previewScene("force"); // TODO: Think about a better design
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preDelete(options, user) {
    const allowed = await super._preDelete(options, user);
    if ( allowed === false ) return false;
    if ( this.active ) game.playlists._onChangeScene(this, {active: false});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( canvas.scene?.id === this.id ) canvas.draw(null);
    for ( const token of this.tokens ) {
      token.baseActor?._unregisterDependentScene(this);
    }

    // Trigger Region Behavior status events
    const user = game.users.get(userId);
    for ( const region of this.regions ) {
      region._handleEvent({
        name: CONST.REGION_EVENTS.BEHAVIOR_STATUS,
        data: {active: false},
        region,
        user
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle Scene activation workflow if the active state is changed to true
   * @param {boolean} active    Is the scene now active?
   * @protected
   */
  _onActivate(active) {

    // Deactivate other scenes
    for ( let s of game.scenes ) {
      if ( s.active && (s !== this) ) {
        s.updateSource({active: false});
        s._initialize();
      }
    }

    // Update the Canvas display
    if ( canvas.initialized && !active ) return canvas.draw(null);
    return this.view();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _preCreateDescendantDocuments(parent, collection, data, options, userId) {
    super._preCreateDescendantDocuments(parent, collection, data, options, userId);

    // Record layer history for child embedded documents
    if ( (userId === game.userId) && this.isView && (parent === this) && !options.isUndo ) {
      const layer = canvas.getCollectionLayer(collection);
      layer?.storeHistory("create", data.map(d => ({_id: d._id})));
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _preUpdateDescendantDocuments(parent, collection, changes, options, userId) {
    super._preUpdateDescendantDocuments(parent, collection, changes, options, userId);

    // Record layer history for child embedded documents
    if ( (userId === game.userId) && this.isView && (parent === this) && !options.isUndo ) {
      const documentCollection = this.getEmbeddedCollection(collection);
      const originals = changes.reduce((data, change) => {
        const doc = documentCollection.get(change._id);
        if ( doc ) {
          const source = doc.toObject();
          const original = foundry.utils.filterObject(source, change);

          // Special handling of flag changes
          if ( "flags" in change ) {
            original.flags ??= {};
            for ( let flag in foundry.utils.flattenObject(change.flags) ) {

              // Record flags that are deleted
              if ( flag.includes(".-=") ) {
                flag = flag.replace(".-=", ".");
                foundry.utils.setProperty(original.flags, flag, foundry.utils.getProperty(source.flags, flag));
              }

              // Record flags that are added
              else if ( !foundry.utils.hasProperty(original.flags, flag) ) {
                let parent;
                for ( ;; ) {
                  const parentFlag = flag.split(".").slice(0, -1).join(".");
                  parent = parentFlag ? foundry.utils.getProperty(original.flags, parentFlag) : original.flags;
                  if ( parent !== undefined ) break;
                  flag = parentFlag;
                }
                if ( foundry.utils.getType(parent) === "Object" ) parent[`-=${flag.split(".").at(-1)}`] = null;
              }
            }
          }

          data.push(original);
        }
        return data;
      }, []);
      const layer = canvas.getCollectionLayer(collection);
      layer?.storeHistory("update", originals);
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _preDeleteDescendantDocuments(parent, collection, ids, options, userId) {
    super._preDeleteDescendantDocuments(parent, collection, ids, options, userId);

    // Record layer history for child embedded documents
    if ( (userId === game.userId) && this.isView && (parent === this) && !options.isUndo ) {
      const documentCollection = this.getEmbeddedCollection(collection);
      const originals = ids.reduce((data, id) => {
        const doc = documentCollection.get(id);
        if ( doc ) data.push(doc.toObject());
        return data;
      }, []);
      const layer = canvas.getCollectionLayer(collection);
      layer?.storeHistory("delete", originals);
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
    super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);
    if ( (parent === this) && documents.some(doc => doc.object?.hasActiveHUD) ) {
      canvas.getCollectionLayer(collection).hud.render();
    }
  }

  /* -------------------------------------------- */
  /*  Importing and Exporting                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  toCompendium(pack, options={}) {
    const data = super.toCompendium(pack, options);
    if ( options.clearState ) delete data.fog.reset;
    if ( options.clearSort ) {
      delete data.navigation;
      delete data.navOrder;
    }
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Create a 300px by 100px thumbnail image for this scene background
   * @param {object} [options]      Options which modify thumbnail creation
   * @param {string|null} [options.img]  A background image to use for thumbnail creation, otherwise the current scene
   *                          background is used.
   * @param {number} [options.width]        The desired thumbnail width. Default is 300px
   * @param {number} [options.height]       The desired thumbnail height. Default is 100px;
   * @param {string} [options.format]       Which image format should be used? image/png, image/jpg, or image/webp
   * @param {number} [options.quality]      What compression quality should be used for jpeg or webp, between 0 and 1
   * @returns {Promise<object>}      The created thumbnail data.
   */
  async createThumbnail({img, width=300, height=100, format="image/webp", quality=0.8}={}) {
    if ( game.settings.get("core", "noCanvas") ) throw new Error(game.i18n.localize("SCENES.GenerateThumbNoCanvas"));

    // Create counter-factual scene data
    const newImage = img !== undefined;
    img = img ?? this.background.src;
    const scene = this.clone({"background.src": img});

    // Load required textures to create the thumbnail
    const tiles = this.tiles.filter(t => t.texture.src && !t.hidden);
    const toLoad = tiles.map(t => t.texture.src);
    if ( img ) toLoad.push(img);
    if ( this.foreground ) toLoad.push(this.foreground);
    await TextureLoader.loader.load(toLoad);

    // Update the cloned image with new background image dimensions
    const backgroundTexture = img ? getTexture(img) : null;
    if ( newImage && backgroundTexture ) {
      scene.updateSource({width: backgroundTexture.width, height: backgroundTexture.height});
    }
    const d = scene.getDimensions();

    // Create a container and add a transparent graphic to enforce the size
    const baseContainer = new PIXI.Container();
    const sceneRectangle = new PIXI.Rectangle(0, 0, d.sceneWidth, d.sceneHeight);
    const baseGraphics = baseContainer.addChild(new PIXI.LegacyGraphics());
    baseGraphics.beginFill(0xFFFFFF, 1.0).drawShape(sceneRectangle).endFill();
    baseGraphics.zIndex = -1;
    baseContainer.mask = baseGraphics;

    // Simulate the way a sprite is drawn
    const drawTile = async tile => {
      const tex = getTexture(tile.texture.src);
      if ( !tex ) return;
      const s = new PIXI.Sprite(tex);
      const {x, y, rotation, width, height} = tile;
      const {scaleX, scaleY, tint} = tile.texture;
      s.anchor.set(0.5, 0.5);
      s.width = Math.abs(width);
      s.height = Math.abs(height);
      s.scale.x *= scaleX;
      s.scale.y *= scaleY;
      s.tint = tint;
      s.position.set(x + (width/2) - d.sceneRect.x, y + (height/2) - d.sceneRect.y);
      s.angle = rotation;
      s.elevation = tile.elevation;
      s.zIndex = tile.sort;
      return s;
    };

    // Background container
    if ( backgroundTexture ) {
      const bg = new PIXI.Sprite(backgroundTexture);
      bg.width = d.sceneWidth;
      bg.height = d.sceneHeight;
      bg.elevation = PrimaryCanvasGroup.BACKGROUND_ELEVATION;
      bg.zIndex = -Infinity;
      baseContainer.addChild(bg);
    }

    // Foreground container
    if ( this.foreground ) {
      const fgTex = getTexture(this.foreground);
      const fg = new PIXI.Sprite(fgTex);
      fg.width = d.sceneWidth;
      fg.height = d.sceneHeight;
      fg.elevation = scene.foregroundElevation;
      fg.zIndex = -Infinity;
      baseContainer.addChild(fg);
    }

    // Tiles
    for ( let t of tiles ) {
      const sprite = await drawTile(t);
      if ( sprite ) baseContainer.addChild(sprite);
    }

    // Sort by elevation and sort
    baseContainer.children.sort((a, b) => (a.elevation - b.elevation) || (a.zIndex - b.zIndex));

    // Render the container to a thumbnail
    const stage = new PIXI.Container();
    stage.addChild(baseContainer);
    return ImageHelper.createThumbnail(stage, {width, height, format, quality});
  }
}
