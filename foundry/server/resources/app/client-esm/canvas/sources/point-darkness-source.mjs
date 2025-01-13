import BaseLightSource from "./base-light-source.mjs";
import PointEffectSourceMixin from "./point-effect-source.mjs";
import {LIGHTING_LEVELS} from "../../../common/constants.mjs";

/**
 * A specialized subclass of the BaseLightSource which renders a source of darkness as a point-based effect.
 * @extends {BaseLightSource}
 * @mixes {PointEffectSource}
 */
export default class PointDarknessSource extends PointEffectSourceMixin(BaseLightSource) {

  /** @override */
  static effectsCollection = "darknessSources";

  /** @override */
  static _dimLightingLevel = LIGHTING_LEVELS.HALFDARK;

  /** @override */
  static _brightLightingLevel = LIGHTING_LEVELS.DARKNESS;

  /** @override */
  static get ANIMATIONS() {
    return CONFIG.Canvas.darknessAnimations;
  }

  /** @override */
  static get _layers() {
    return {
      darkness: {
        defaultShader: AdaptiveDarknessShader,
        blendMode: "MAX_COLOR"
      }
    };
  }

  /**
   * The optional geometric shape is solely utilized for visual representation regarding darkness sources.
   * Used only when an additional radius is added for visuals.
   * @protected
   * @type {SourceShape}
   */
  _visualShape;

  /**
   * Padding applied on the darkness source shape for visual appearance only.
   * Note: for now, padding is increased radius. It might evolve in a future release.
   * @type {number}
   * @protected
   */
  _padding = (CONFIG.Canvas.darknessSourcePaddingMultiplier ?? 0) * canvas.grid.size;

  /**
   * The Edge instances added by this darkness source.
   * @type {Edge[]}
   */
  edges = [];

  /**
   * The normalized border distance.
   * @type {number}
   */
  #borderDistance = 0;

  /* -------------------------------------------- */
  /*  Darkness Source Properties                  */
  /* -------------------------------------------- */

  /**
   * A convenience accessor to the darkness layer mesh.
   * @type {PointSourceMesh}
   */
  get darkness() {
    return this.layers.darkness.mesh;
  }

  /* -------------------------------------------- */
  /*  Source Initialization and Management        */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _initialize(data) {
    super._initialize(data);
    this.data.radius = this.data.bright = this.data.dim = Math.max(this.data.dim ?? 0, this.data.bright ?? 0);
    this.#borderDistance = this.radius / (this.radius + this._padding);
  }

  /* -------------------------------------------- */


  /** @inheritDoc */
  _createShapes() {
    this.#deleteEdges();
    const origin = {x: this.data.x, y: this.data.y};
    const config = this._getPolygonConfiguration();
    const polygonClass = CONFIG.Canvas.polygonBackends[this.constructor.sourceType];

    // Create shapes based on padding
    if ( this.radius < config.radius ) {
      this._visualShape = polygonClass.create(origin, config);
      this.shape = this.#createShapeFromVisualShape(this.radius);
    }
    else {
      this._visualShape = null;
      this.shape = polygonClass.create(origin, config);
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _configure(changes) {
    super._configure(changes);
    this.#createEdges();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getPolygonConfiguration() {
    return Object.assign(super._getPolygonConfiguration(), {
      useThreshold: true,
      includeDarkness: false,
      radius: (this.data.disabled || this.suppressed) ? 0 : this.radius + this._padding,
    });
  }

  /* -------------------------------------------- */

  _drawMesh(layerId) {
    const mesh = super._drawMesh(layerId);
    if ( mesh ) mesh.scale.set(this.radius + this._padding);
    return mesh;
  }

  /* -------------------------------------------- */

  /** @override */
  _updateGeometry() {
    const {x, y} = this.data;
    const radius = this.radius + this._padding;
    const offset = this._flags.renderSoftEdges ? this.constructor.EDGE_OFFSET : 0;
    const shape = this._visualShape ?? this.shape;
    const pm = new PolygonMesher(shape, {x, y, radius, normalize: true, offset});
    this._geometry = pm.triangulate(this._geometry);
    const bounds = new PIXI.Rectangle(0, 0, 0, 0);
    if ( radius > 0 ) {
      const b = shape instanceof PointSourcePolygon ? shape.bounds : shape.getBounds();
      bounds.x = (b.x - x) / radius;
      bounds.y = (b.y - y) / radius;
      bounds.width = b.width / radius;
      bounds.height = b.height / radius;
    }
    if ( this._geometry.bounds ) this._geometry.bounds.copyFrom(bounds);
    else this._geometry.bounds = bounds;
  }

  /* -------------------------------------------- */

  /**
   * Create a radius constrained polygon from the visual shape polygon.
   * If the visual shape is not created, no polygon is created.
   * @param {number} radius           The radius to constraint to.
   * @returns {PointSourcePolygon} The new polygon or null if no visual shape is present.
   */
  #createShapeFromVisualShape(radius) {
    if ( !this._visualShape ) return null;
    const {x, y} = this.data;
    const circle = new PIXI.Circle(x, y, radius);
    const density = PIXI.Circle.approximateVertexDensity(radius);
    return this._visualShape.applyConstraint(circle, {density, scalingFactor: 100});
  }

  /* -------------------------------------------- */

  /**
   * Create the Edge instances that correspond to this darkness source.
   */
  #createEdges() {
    if ( !this.active || this.isPreview ) return;
    const cls = foundry.canvas.edges.Edge;
    const block = CONST.WALL_SENSE_TYPES.NORMAL;
    const direction = CONST.WALL_DIRECTIONS.LEFT;
    const points = [...this.shape.points];
    let p0 = {x: points[0], y: points[1]};
    points.push(p0.x, p0.y);
    let p1;
    for ( let i=2; i<points.length; i+=2 ) {
      p1 = {x: points[i], y: points[i+1]};
      const id = `${this.sourceId}.${i/2}`;
      const edge = new cls(p0, p1, {type: "darkness", id, object: this.object, direction, light: block, sight: block});
      this.edges.push(edge);
      canvas.edges.set(edge.id, edge);
      p0 = p1;
    }
  }

  /* -------------------------------------------- */

  /**
   * Remove edges from the active Edges collection.
   */
  #deleteEdges() {
    for ( const edge of this.edges ) canvas.edges.delete(edge.id);
    this.edges.length = 0;
  }

  /* -------------------------------------------- */
  /*  Shader Management                           */
  /* -------------------------------------------- */

  /**
   * Update the uniforms of the shader on the darkness layer.
   */
  _updateDarknessUniforms() {
    const u = this.layers.darkness.shader?.uniforms;
    if ( !u ) return;
    u.color = this.colorRGB ?? this.layers.darkness.shader.constructor.defaultUniforms.color;
    u.enableVisionMasking = canvas.effects.visionSources.some(s => s.active) || !game.user.isGM;
    u.borderDistance = this.#borderDistance;
    u.colorationAlpha = this.data.alpha * 2;

    // Passing screenDimensions to use screen size render textures
    u.screenDimensions = canvas.screenDimensions;
    if ( !u.depthTexture ) u.depthTexture = canvas.masks.depth.renderTexture;
    if ( !u.primaryTexture ) u.primaryTexture = canvas.primary.renderTexture;
    if ( !u.visionTexture ) u.visionTexture = canvas.masks.vision.renderTexture;

    // Flag uniforms as updated
    this.layers.darkness.reset = false;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _destroy() {
    this.#deleteEdges();
    super._destroy();
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get isDarkness() {
    const msg = "BaseLightSource#isDarkness is now obsolete. Use DarknessSource instead.";
    foundry.utils.logCompatibilityWarning(msg, { since: 12, until: 14});
    return true;
  }
}
