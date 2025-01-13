import {CircleShapeData, EllipseShapeData, PolygonShapeData, RectangleShapeData} from "../../data/_module.mjs";

/**
 * A shape of a {@link Region}.
 * @template {data.BaseShapeData} T
 * @abstract
 */
export default class RegionShape {

  /**
   * Create a RegionShape.
   * @param {T} data    The shape data.
   * @internal
   */
  constructor(data) {
    this.#data = data;
  }

  /* -------------------------------------------- */

  /**
   * Create the RegionShape from the shape data.
   * @template {data.BaseShapeData} T
   * @param {T} data    The shape data.
   * @returns {RegionShape<T>}
   */
  static create(data) {
    switch ( data.type ) {
      case "circle": return new RegionCircle(data);
      case "ellipse": return new RegionEllipse(data);
      case "polygon": return new RegionPolygon(data);
      case "rectangle": return new RegionRectangle(data);
      default: throw new Error("Invalid shape type");
    }
  }

  /* -------------------------------------------- */

  /**
   * The data of this shape.
   * It is owned by the shape and must not be modified.
   * @type {T}
   */
  get data() {
    return this.#data;
  }

  #data;

  /* -------------------------------------------- */

  /**
   * Is this a hole?
   * @type {boolean}
   */
  get isHole() {
    return this.data.hole;
  }

  /* -------------------------------------------- */

  /**
   * The Clipper paths of this shape.
   * The winding numbers are 1 or 0.
   * @type {ReadonlyArray<ReadonlyArray<ClipperLib.IntPoint>>}
   */
  get clipperPaths() {
    return this.#clipperPaths ??= ClipperLib.Clipper.PolyTreeToPaths(this.clipperPolyTree);
  }

  #clipperPaths;

  /* -------------------------------------------- */

  /**
   * The Clipper polygon tree of this shape.
   * @type {ClipperLib.PolyTree}
   */
  get clipperPolyTree() {
    let clipperPolyTree = this.#clipperPolyTree;
    if ( !clipperPolyTree ) {
      clipperPolyTree = this._createClipperPolyTree();
      if ( Array.isArray(clipperPolyTree) ) {
        const clipperPolyNode = new ClipperLib.PolyNode();
        clipperPolyNode.m_polygon = clipperPolyTree;
        clipperPolyTree = new ClipperLib.PolyTree();
        clipperPolyTree.AddChild(clipperPolyNode);
        clipperPolyTree.m_AllPolys.push(clipperPolyNode);
      }
      this.#clipperPolyTree = clipperPolyTree;
    }
    return clipperPolyTree;
  }

  #clipperPolyTree;

  /* -------------------------------------------- */

  /**
   * Create the Clipper polygon tree of this shape.
   * This function may return a single positively-orientated and non-selfintersecting Clipper path instead of a tree,
   * which is automatically converted to a Clipper polygon tree.
   * This function is called only once. It is not called if the shape is empty.
   * @returns {ClipperLib.PolyTree|ClipperLib.IntPoint[]}
   * @protected
   * @abstract
   */
  _createClipperPolyTree() {
    throw new Error("A subclass of the RegionShape must implement the _createClipperPolyTree method.");
  }

  /* -------------------------------------------- */

  /**
   * Draw shape into the graphics.
   * @param {PIXI.Graphics} graphics    The graphics to draw the shape into.
   * @protected
   * @internal
   */
  _drawShape(graphics) {
    throw new Error("A subclass of the RegionShape must implement the _drawShape method.");
  }
}

/* -------------------------------------------- */

/**
 * A circle of a {@link Region}.
 * @extends {RegionShape<data.CircleShapeData>}
 *
 * @param {data.CircleShapeData} data    The shape data.
 */
class RegionCircle extends RegionShape {
  constructor(data) {
    if ( !(data instanceof CircleShapeData) ) throw new Error("Invalid shape data");
    super(data);
  }

  /* -------------------------------------------- */

  /**
   * The vertex density epsilon used to create a polygon approximation of the circle.
   * @type {number}
   */
  static #VERTEX_DENSITY_EPSILON = 1;

  /* -------------------------------------------- */

  /** @override */
  _createClipperPolyTree() {
    const scalingFactor = Region.CLIPPER_SCALING_FACTOR;
    const data = this.data;
    const x = data.x * scalingFactor;
    const y = data.y * scalingFactor;
    const radius = data.radius * scalingFactor;
    const epsilon = RegionCircle.#VERTEX_DENSITY_EPSILON * scalingFactor;
    const density = PIXI.Circle.approximateVertexDensity(radius, epsilon);
    const path = new Array(density);
    for ( let i = 0; i < density; i++ ) {
      const angle = 2 * Math.PI * (i / density);
      path[i] = new ClipperLib.IntPoint(
        Math.round(x + (Math.cos(angle) * radius)),
        Math.round(y + (Math.sin(angle) * radius))
      );
    }
    return path;
  }

  /* -------------------------------------------- */

  /** @override */
  _drawShape(graphics) {
    const {x, y, radius} = this.data;
    graphics.drawCircle(x, y, radius);
  }
}

/* -------------------------------------------- */

/**
 * An ellipse of a {@link Region}.
 * @extends {RegionShape<data.EllipseShapeData>}
 *
 * @param {data.EllipseShapeData} data    The shape data.
 */
class RegionEllipse extends RegionShape {
  constructor(data) {
    if ( !(data instanceof EllipseShapeData) ) throw new Error("Invalid shape data");
    super(data);
  }

  /* -------------------------------------------- */

  /**
   * The vertex density epsilon used to create a polygon approximation of the circle.
   * @type {number}
   */
  static #VERTEX_DENSITY_EPSILON = 1;

  /* -------------------------------------------- */

  /** @override */
  _createClipperPolyTree() {
    const scalingFactor = Region.CLIPPER_SCALING_FACTOR;
    const data = this.data;
    const x = data.x * scalingFactor;
    const y = data.y * scalingFactor;
    const radiusX = data.radiusX * scalingFactor;
    const radiusY = data.radiusY * scalingFactor;
    const epsilon = RegionEllipse.#VERTEX_DENSITY_EPSILON * scalingFactor;
    const density = PIXI.Circle.approximateVertexDensity((radiusX + radiusY) / 2, epsilon);
    const rotation = Math.toRadians(data.rotation);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const path = new Array(density);
    for ( let i = 0; i < density; i++ ) {
      const angle = 2 * Math.PI * (i / density);
      const dx = Math.cos(angle) * radiusX;
      const dy = Math.sin(angle) * radiusY;
      path[i] = new ClipperLib.IntPoint(
        Math.round(x + ((cos * dx) - (sin * dy))),
        Math.round(y + ((sin * dx) + (cos * dy)))
      );
    }
    return path;
  }

  /* -------------------------------------------- */

  /** @override */
  _drawShape(graphics) {
    const {x, y, radiusX, radiusY, rotation} = this.data;
    if ( rotation === 0 ) {
      graphics.drawEllipse(x, y, radiusX, radiusY);
    } else {
      graphics.setMatrix(new PIXI.Matrix()
        .translate(-x, -x)
        .rotate(Math.toRadians(rotation))
        .translate(x, y));
      graphics.drawEllipse(x, y, radiusX, radiusY);
      graphics.setMatrix(null);
    }
  }
}

/* -------------------------------------------- */

/**
 * A polygon of a {@link Region}.
 * @extends {RegionShape<data.PolygonShapeData>}
 *
 * @param {data.PolygonShapeData} data    The shape data.
 */
class RegionPolygon extends RegionShape {
  constructor(data) {
    if ( !(data instanceof PolygonShapeData) ) throw new Error("Invalid shape data");
    super(data);
  }

  /* -------------------------------------------- */

  /** @override */
  _createClipperPolyTree() {
    const scalingFactor = Region.CLIPPER_SCALING_FACTOR;
    const points = this.data.points;
    const path = new Array(points.length / 2);
    for ( let i = 0, j = 0; i < path.length; i++ ) {
      path[i] = new ClipperLib.IntPoint(
        Math.round(points[j++] * scalingFactor),
        Math.round(points[j++] * scalingFactor)
      );
    }
    if ( !ClipperLib.Clipper.Orientation(path) ) path.reverse();
    return path;
  }

  /* -------------------------------------------- */

  /** @override */
  _drawShape(graphics) {
    graphics.drawPolygon(this.data.points);
  }
}

/* -------------------------------------------- */

/**
 * A rectangle of a {@link Region}.
 * @extends {RegionShape<data.RectangleShapeData>}
 *
 * @param {data.RectangleShapeData} data    The shape data.
 */
class RegionRectangle extends RegionShape {
  constructor(data) {
    if ( !(data instanceof RectangleShapeData) ) throw new Error("Invalid shape data");
    super(data);
  }

  /* -------------------------------------------- */

  /** @override */
  _createClipperPolyTree() {
    let p0;
    let p1;
    let p2;
    let p3;
    const scalingFactor = Region.CLIPPER_SCALING_FACTOR;
    const {x, y, width, height, rotation} = this.data;
    let x0 = x * scalingFactor;
    let y0 = y * scalingFactor;
    let x1 = (x + width) * scalingFactor;
    let y1 = (y + height) * scalingFactor;

    // The basic non-rotated case
    if ( rotation === 0 ) {
      x0 = Math.round(x0);
      y0 = Math.round(y0);
      x1 = Math.round(x1);
      y1 = Math.round(y1);
      p0 = new ClipperLib.IntPoint(x0, y0);
      p1 = new ClipperLib.IntPoint(x1, y0);
      p2 = new ClipperLib.IntPoint(x1, y1);
      p3 = new ClipperLib.IntPoint(x0, y1);
    }

    // The more complex rotated case
    else {
      const tx = (x0 + x1) / 2;
      const ty = (y0 + y1) / 2;
      x0 -= tx;
      y0 -= ty;
      x1 -= tx;
      y1 -= ty;
      const angle = Math.toRadians(rotation);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x00 = Math.round((cos * x0) - (sin * y0) + tx);
      const y00 = Math.round((sin * x0) + (cos * y0) + ty);
      const x10 = Math.round((cos * x1) - (sin * y0) + tx);
      const y10 = Math.round((sin * x1) + (cos * y0) + ty);
      const x11 = Math.round((cos * x1) - (sin * y1) + tx);
      const y11 = Math.round((sin * x1) + (cos * y1) + ty);
      const x01 = Math.round((cos * x0) - (sin * y1) + tx);
      const y01 = Math.round((sin * x0) + (cos * y1) + ty);
      p0 = new ClipperLib.IntPoint(x00, y00);
      p1 = new ClipperLib.IntPoint(x10, y10);
      p2 = new ClipperLib.IntPoint(x11, y11);
      p3 = new ClipperLib.IntPoint(x01, y01);
    }
    return [p0, p1, p2, p3];
  }

  /* -------------------------------------------- */

  /** @override */
  _drawShape(graphics) {
    const {x, y, width, height, rotation} = this.data;
    if ( rotation === 0 ) {
      graphics.drawRect(x, y, width, height);
    } else {
      const centerX = x + (width / 2);
      const centerY = y + (height / 2);
      graphics.setMatrix(new PIXI.Matrix()
        .translate(-centerX, -centerY)
        .rotate(Math.toRadians(rotation))
        .translate(centerX, centerY));
      graphics.drawRect(x, y, width, height);
      graphics.setMatrix(null);
    }
  }
}
