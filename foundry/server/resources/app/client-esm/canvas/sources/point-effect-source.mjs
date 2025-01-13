
/**
 * @typedef {import("./base-effect-source.mjs").BaseEffectSourceData} BaseEffectSourceData
 */

/**
 * @typedef {Object} PointEffectSourceData
 * @property {number} radius              The radius of the source
 * @property {number} externalRadius      A secondary radius used for limited angles
 * @property {number} rotation            The angle of rotation for this point source
 * @property {number} angle               The angle of emission for this point source
 * @property {boolean} walls              Whether or not the source is constrained by walls
 */

/**
 * TODO - documentation required about what a PointEffectSource is.
 * @param BaseSource
 * @returns {{new(): PointEffectSource, prototype: PointEffectSource}}
 * @mixin
 */
export default function PointEffectSourceMixin(BaseSource) {
  /**
   * @extends {BaseEffectSource<BaseEffectSourceData & PointEffectSourceData, PointSourcePolygon>}
   * @abstract
   */
  return class PointEffectSource extends BaseSource {

    /** @inheritDoc */
    static defaultData = {
      ...super.defaultData,
      radius: 0,
      externalRadius: 0,
      rotation: 0,
      angle: 360,
      walls: true
    }

    /* -------------------------------------------- */

    /**
     * A convenience reference to the radius of the source.
     * @type {number}
     */
    get radius() {
      return this.data.radius ?? 0;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _initialize(data) {
      super._initialize(data);
      if ( this.data.radius > 0 ) this.data.radius = Math.max(this.data.radius, this.data.externalRadius);
    }

    /* -------------------------------------------- */
    /*  Point Source Geometry Methods               */
    /* -------------------------------------------- */

    /** @inheritDoc */
    _initializeSoftEdges() {
      super._initializeSoftEdges();
      const isCircle = (this.shape instanceof PointSourcePolygon) && this.shape.isCompleteCircle();
      this._flags.renderSoftEdges &&= !isCircle;
    }

    /* -------------------------------------------- */

    /**
     * Configure the parameters of the polygon that is generated for this source.
     * @returns {PointSourcePolygonConfig}
     * @protected
     */
    _getPolygonConfiguration() {
      return {
        type: this.data.walls ? this.constructor.sourceType : "universal",
        radius: (this.data.disabled || this.suppressed) ? 0 : this.radius,
        externalRadius: this.data.externalRadius,
        angle: this.data.angle,
        rotation: this.data.rotation,
        source: this
      };
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _createShapes() {
      const origin = {x: this.data.x, y: this.data.y};
      const config = this._getPolygonConfiguration();
      const polygonClass = CONFIG.Canvas.polygonBackends[this.constructor.sourceType];
      this.shape = polygonClass.create(origin, config);
    }

    /* -------------------------------------------- */
    /*  Rendering methods                           */
    /* -------------------------------------------- */

    /** @override */
    _drawMesh(layerId) {
      const mesh = super._drawMesh(layerId);
      if ( mesh ) mesh.scale.set(this.radius);
      return mesh;
    }

    /** @override */
    _updateGeometry() {
      const {x, y} = this.data;
      const radius = this.radius;
      const offset = this._flags.renderSoftEdges ? this.constructor.EDGE_OFFSET : 0;
      const pm = new PolygonMesher(this.shape, {x, y, radius, normalize: true, offset});
      this._geometry = pm.triangulate(this._geometry);
      const bounds = new PIXI.Rectangle(0, 0, 0, 0);
      if ( radius > 0 ) {
        const b = this.shape instanceof PointSourcePolygon ? this.shape.bounds : this.shape.getBounds();
        bounds.x = (b.x - x) / radius;
        bounds.y = (b.y - y) / radius;
        bounds.width = b.width / radius;
        bounds.height = b.height / radius;
      }
      if ( this._geometry.bounds ) this._geometry.bounds.copyFrom(bounds);
      else this._geometry.bounds = bounds;
    }

    /* -------------------------------------------- */
    /*  Deprecations and Compatibility              */
    /* -------------------------------------------- */

    /**
     * @deprecated since v11
     * @ignore
     */
    set radius(radius) {
      const msg = "The setter PointEffectSource#radius is deprecated."
        + " The radius should not be set anywhere except in PointEffectSource#_initialize.";
      foundry.utils.logCompatibilityWarning(msg, { since: 11, until: 13});
      this.data.radius = radius;
    }

    /* -------------------------------------------- */

    /**
     * @deprecated since v11
     * @ignore
     */
    get los() {
      const msg = "PointEffectSource#los is deprecated in favor of PointEffectSource#shape.";
      foundry.utils.logCompatibilityWarning(msg, { since: 11, until: 13});
      return this.shape;
    }

    /* -------------------------------------------- */

    /**
     * @deprecated since v11
     * @ignore
     */
    set los(shape) {
      const msg = "PointEffectSource#los is deprecated in favor of PointEffectSource#shape.";
      foundry.utils.logCompatibilityWarning(msg, { since: 11, until: 13});
      this.shape = shape;
    }
  }
}

