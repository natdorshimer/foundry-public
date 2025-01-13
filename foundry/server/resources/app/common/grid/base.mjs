import {GRID_TYPES} from "../constants.mjs";
import Color from "../utils/color.mjs";
import {lineLineIntersection} from "../utils/geometry.mjs";
import {logCompatibilityWarning} from "../utils/logging.mjs";

/**
 * @typedef {object} GridConfiguration
 * @property {number} size            The size of a grid space in pixels (a positive number)
 * @property {number} [distance=1]    The distance of a grid space in units (a positive number)
 * @property {string} [units=""]      The units of measurement
 * @property {string} [style="solidLines"] The style of the grid
 * @property {ColorSource} [color=0]  The color of the grid
 * @property {number} [alpha=1]       The alpha of the grid
 * @property {number} [thickness=1]   The line thickness of the grid
 */

/**
 * A pair of row and column coordinates of a grid space.
 * @typedef {object} GridOffset
 * @property {number} i    The row coordinate
 * @property {number} j    The column coordinate
 */

/**
 * An offset of a grid space or a point with pixel coordinates.
 * @typedef {GridOffset|Point} GridCoordinates
 */

/**
 * Snapping behavior is defined by the snapping mode at the given resolution of the grid.
 * @typedef {object} GridSnappingBehavior
 * @property {number} mode              The snapping mode (a union of {@link CONST.GRID_SNAPPING_MODES})
 * @property {number} [resolution=1]    The resolution (a positive integer)
 */

/**
 * The base grid class.
 * @abstract
 */
export default class BaseGrid {
  /**
   * The base grid constructor.
   * @param {GridConfiguration} config                        The grid configuration
   */
  constructor({size, distance=1, units="", style="solidLines", thickness=1, color, alpha=1}) {
    /** @deprecated since v12 */
    if ( "dimensions" in arguments[0] ) {
      const msg = "The constructor BaseGrid({dimensions, color, alpha}) is deprecated "
        + "in favor of BaseGrid({size, distance, units, style, thickness, color, alpha}).";
      logCompatibilityWarning(msg, {since: 12, until: 14});
      const dimensions = arguments[0].dimensions;
      size = dimensions.size;
      distance = dimensions.distance || 1;
    }

    if ( size === undefined ) throw new Error(`${this.constructor.name} cannot be constructed without a size`);

    // Convert the color to a CSS string
    if ( color ) color = Color.from(color);
    if ( !color?.valid ) color = new Color(0);

    /**
     * The size of a grid space in pixels.
     * @type {number}
     */
    this.size = size;

    /**
     * The width of a grid space in pixels.
     * @type {number}
     */
    this.sizeX = size;

    /**
     * The height of a grid space in pixels.
     * @type {number}
     */
    this.sizeY = size;

    /**
     * The distance of a grid space in units.
     * @type {number}
     */
    this.distance = distance;

    /**
     * The distance units used in this grid.
     * @type {string}
     */
    this.units = units;

    /**
     * The style of the grid.
     * @type {string}
     */
    this.style = style;

    /**
     * The thickness of the grid.
     * @type {number}
     */
    this.thickness = thickness;

    /**
     * The color of the grid.
     * @type {Color}
     */
    this.color = color;

    /**
     * The opacity of the grid.
     * @type {number}
     */
    this.alpha = alpha;
  }

  /* -------------------------------------------- */

  /**
   * The grid type (see {@link CONST.GRID_TYPES}).
   * @type {number}
   */
  type;

  /* -------------------------------------------- */

  /**
   * Is this a gridless grid?
   * @type {boolean}
   */
  get isGridless() {
    return this.type === GRID_TYPES.GRIDLESS;
  }

  /* -------------------------------------------- */

  /**
   * Is this a square grid?
   * @type {boolean}
   */
  get isSquare() {
    return this.type === GRID_TYPES.SQUARE;
  }

  /* -------------------------------------------- */

  /**
   * Is this a hexagonal grid?
   * @type {boolean}
   */
  get isHexagonal() {
    return (this.type >= GRID_TYPES.HEXODDR) && (this.type <= GRID_TYPES.HEXEVENQ);
  }

  /* -------------------------------------------- */

  /**
   * Calculate the total size of the canvas with padding applied, as well as the top-left coordinates of the inner
   * rectangle that houses the scene.
   * @param {number} sceneWidth         The width of the scene.
   * @param {number} sceneHeight        The height of the scene.
   * @param {number} padding            The percentage of padding.
   * @returns {{width: number, height: number, x: number, y: number, rows: number, columns: number}}
   * @abstract
   */
  calculateDimensions(sceneWidth, sceneHeight, padding) {
    throw new Error("A subclass of the BaseGrid must implement the calculateDimensions method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the offset of the grid space corresponding to the given coordinates.
   * @param {GridCoordinates} coords    The coordinates
   * @returns {GridOffset}              The offset
   * @abstract
   */
  getOffset(coords) {
    throw new Error("A subclass of the BaseGrid must implement the getOffset method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the smallest possible range containing the offsets of all grid spaces that intersect the given bounds.
   * If the bounds are empty (nonpositive width or height), then the offset range is empty.
   * @example
   * ```js
   * const [i0, j0, i1, j1] = grid.getOffsetRange(bounds);
   * for ( let i = i0; i < i1; i++ ) {
   *   for ( let j = j0; j < j1; j++ ) {
   *     const offset = {i, j};
   *     // ...
   *   }
   * }
   * ```
   * @param {Rectangle} bounds                                      The bounds
   * @returns {[i0: number, j0: number, i1: number, j1: number]}    The offset range
   * @abstract
   */
  getOffsetRange({x, y, width, height}) {
    throw new Error("A subclass of the BaseGrid must implement the getOffsetRange method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the offsets of the grid spaces adjacent to the one corresponding to the given coordinates.
   * Returns an empty array in gridless grids.
   * @param {GridCoordinates} coords    The coordinates
   * @returns {GridOffset[]}            The adjacent offsets
   * @abstract
   */
  getAdjacentOffsets(coords) {
    throw new Error("A subclass of the BaseGrid must implement the getAdjacentOffsets method");
  }

  /* -------------------------------------------- */

  /**
   * Returns true if the grid spaces corresponding to the given coordinates are adjacent to each other.
   * In square grids with illegal diagonals the diagonally neighboring grid spaces are not adjacent.
   * Returns false in gridless grids.
   * @param {GridCoordinates} coords1    The first coordinates
   * @param {GridCoordinates} coords2    The second coordinates
   * @returns {boolean}
   * @abstract
   */
  testAdjacency(coords1, coords2) {
    throw new Error("A subclass of the BaseGrid must implement the testAdjacency method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the offset of the grid space corresponding to the given coordinates
   * shifted by one grid space in the given direction.
   * In square grids with illegal diagonals the offset of the given coordinates is returned
   * if the direction is diagonal.
   * @param {GridCoordinates} coords    The coordinates
   * @param {number} direction          The direction (see {@link CONST.MOVEMENT_DIRECTIONS})
   * @returns {GridOffset}              The offset
   * @abstract
   */
  getShiftedOffset(coords, direction) {
    throw new Error("A subclass of the BaseGrid must implement the getShiftedOffset method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the point shifted by the difference between the grid space corresponding to the given coordinates
   * and the shifted grid space in the given direction.
   * In square grids with illegal diagonals the point is not shifted if the direction is diagonal.
   * In gridless grids the point coordinates are shifted by the grid size.
   * @param {Point} point         The point that is to be shifted
   * @param {number} direction    The direction (see {@link CONST.MOVEMENT_DIRECTIONS})
   * @returns {Point}             The shifted point
   * @abstract
   */
  getShiftedPoint(point, direction) {
    throw new Error("A subclass of the BaseGrid must implement the getShiftedPoint method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the top-left point of the grid space corresponding to the given coordinates.
   * If given a point, the top-left point of the grid space that contains it is returned.
   * In gridless grids a point with the same coordinates as the given point is returned.
   * @param {GridCoordinates} coords    The coordinates
   * @returns {Point}                   The top-left point
   * @abstract
   */
  getTopLeftPoint(coords) {
    throw new Error("A subclass of the BaseGrid must implement the getTopLeftPoint method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the center point of the grid space corresponding to the given coordinates.
   * If given a point, the center point of the grid space that contains it is returned.
   * In gridless grids a point with the same coordinates as the given point is returned.
   * @param {GridCoordinates} coords    The coordinates
   * @returns {Point}                   The center point
   * @abstract
   */
  getCenterPoint(coords) {
    throw new Error("A subclass of the BaseGrid must implement the getCenterPoint method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the points of the grid space shape relative to the center point.
   * The points are returned in the same order as in {@link BaseGrid#getVertices}.
   * In gridless grids an empty array is returned.
   * @returns {Point[]}    The points of the polygon
   * @abstract
   */
  getShape() {
    throw new Error("A subclass of the BaseGrid must implement the getShape method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the vertices of the grid space corresponding to the given coordinates.
   * The vertices are returned ordered in positive orientation with the first vertex
   * being the top-left vertex in square grids, the top vertex in row-oriented
   * hexagonal grids, and the left vertex in column-oriented hexagonal grids.
   * In gridless grids an empty array is returned.
   * @param {GridCoordinates} coords    The coordinates
   * @returns {Point[]}                 The vertices
   * @abstract
   */
  getVertices(coords) {
    throw new Error("A subclass of the BaseGrid must implement the getVertices method");
  }

  /* -------------------------------------------- */

  /**
   * Snaps the given point to the grid.
   * @param {Point} point                      The point that is to be snapped
   * @param {GridSnappingBehavior} behavior    The snapping behavior
   * @returns {Point}                          The snapped point
   * @abstract
   */
  getSnappedPoint({x, y}, behavior) {
    throw new Error("A subclass of the BaseGrid must implement the getSnappedPoint method");
  }

  /* -------------------------------------------- */

  /**
   * @typedef {GridCoordinates | (GridCoordinates & {teleport: boolean})} GridMeasurePathWaypoint
   */

  /**
   * The measurements of a waypoint.
   * @typedef {object} GridMeasurePathResultWaypoint
   * @property {GridMeasurePathResultSegment|null} backward    The segment from the previous waypoint to this waypoint.
   * @property {GridMeasurePathResultSegment|null} forward     The segment from this waypoint to the next waypoint.
   * @property {number} distance    The total distance travelled along the path up to this waypoint.
   * @property {number} spaces      The total number of spaces moved along a direct path up to this waypoint.
   * @property {number} cost    The total cost of the direct path ({@link BaseGrid#getDirectPath}) up to this waypoint.
   */

  /**
   * The measurements of a segment.
   * @typedef {object} GridMeasurePathResultSegment
   * @property {GridMeasurePathResultWaypoint} from    The waypoint that this segment starts from.
   * @property {GridMeasurePathResultWaypoint} to      The waypoint that this segment goes to.
   * @property {boolean} teleport   Is teleporation?
   * @property {number} distance    The distance travelled in grid units along this segment.
   * @property {number} spaces      The number of spaces moved along this segment.
   * @property {number} cost    The cost of the direct path ({@link BaseGrid#getDirectPath}) between the two waypoints.
   */

  /**
   * The measurements result of {@link BaseGrid#measurePath}.
   * @typedef {object} GridMeasurePathResult
   * @property {GridMeasurePathResultWaypoint[]} waypoints    The measurements at each waypoint.
   * @property {GridMeasurePathResultSegment[]} segments      The measurements at each segment.
   * @property {number} distance    The total distance travelled along the path through all waypoints.
   * @property {number} spaces      The total number of spaces moved along a direct path through all waypoints.
   *                                Moving from a grid space to any of its neighbors counts as 1 step.
   *                                Always 0 in gridless grids.
   * @property {number} cost   The total cost of the direct path ({@link BaseGrid#getDirectPath}) through all waypoints.
   */

  /**
   * A function that returns the cost for a given move between grid spaces.
   * In square and hexagonal grids the grid spaces are always adjacent unless teleported.
   * The distance is 0 if and only if teleported. The function is never called with the same offsets.
   * @callback GridMeasurePathCostFunction
   * @param {GridOffset} from    The offset that is moved from.
   * @param {GridOffset} to      The offset that is moved to.
   * @param {number} distance    The distance between the grid spaces, or 0 if teleported.
   * @returns {number}           The cost of the move between the grid spaces.
   */

  /**
   * Measure a shortest, direct path through the given waypoints.
   * @param {GridMeasurePathWaypoint[]} waypoints           The waypoints the path must pass through
   * @param {object} [options]                              Additional measurement options
   * @param {GridMeasurePathCostFunction} [options.cost]    The function that returns the cost
   *   for a given move between grid spaces (default is the distance travelled along the direct path)
   * @returns {GridMeasurePathResult}        The measurements a shortest, direct path through the given waypoints.
   */
  measurePath(waypoints, options={}) {
    const result = {
      waypoints: [],
      segments: []
    };
    if ( waypoints.length !== 0 ) {
      let from = {backward: null, forward: null};
      result.waypoints.push(from);
      for ( let i = 1; i < waypoints.length; i++ ) {
        const to = {backward: null, forward: null};
        const segment = {from, to};
        from.forward = to.backward = segment;
        result.waypoints.push(to);
        result.segments.push(segment);
        from = to;
      }
    }
    this._measurePath(waypoints, options, result);
    return result;
  }

  /* -------------------------------------------- */

  /**
   * Measures the path and writes the measurements into `result`.
   * Called by {@link BaseGrid#measurePath}.
   * @param {GridMeasurePathWaypoint[]} waypoints           The waypoints the path must pass through
   * @param {object} options                                Additional measurement options
   * @param {GridMeasurePathCostFunction} [options.cost]    The function that returns the cost
   *   for a given move between grid spaces (default is the distance travelled)
   * @param {GridMeasurePathResult} result    The measurement result that the measurements need to be written to
   * @protected
   * @abstract
   */
  _measurePath(waypoints, options, result) {
    throw new Error("A subclass of the BaseGrid must implement the _measurePath method");
  }

  /* -------------------------------------------- */

  /**
   * Returns the sequence of grid offsets of a shortest, direct path passing through the given waypoints.
   * @param {GridCoordinates[]} waypoints    The waypoints the path must pass through
   * @returns {GridOffset[]}                 The sequence of grid offsets of a shortest, direct path
   * @abstract
   */
  getDirectPath(waypoints) {
    throw new Error("A subclass of the BaseGrid must implement the getDirectPath method");
  }

  /* -------------------------------------------- */

  /**
   * Get the point translated in a direction by a distance.
   * @param {Point} point         The point that is to be translated.
   * @param {number} direction    The angle of direction in degrees.
   * @param {number} distance     The distance in grid units.
   * @returns {Point}             The translated point.
   * @abstract
   */
  getTranslatedPoint(point, direction, distance) {
    throw new Error("A subclass of the BaseGrid must implement the getTranslatedPoint method");
  }

  /* -------------------------------------------- */

  /**
   * Get the circle polygon given the radius in grid units for this grid.
   * The points of the polygon are returned ordered in positive orientation.
   * In gridless grids an approximation of the true circle with a deviation of less than 0.25 pixels is returned.
   * @param {Point} center     The center point of the circle.
   * @param {number} radius    The radius in grid units.
   * @returns {Point[]}        The points of the circle polygon.
   * @abstract
   */
  getCircle(center, radius) {
    throw new Error("A subclass of the BaseGrid must implement the getCircle method");
  }

  /* -------------------------------------------- */

  /**
   * Get the cone polygon given the radius in grid units and the angle in degrees for this grid.
   * The points of the polygon are returned ordered in positive orientation.
   * In gridless grids an approximation of the true cone with a deviation of less than 0.25 pixels is returned.
   * @param {Point} origin        The origin point of the cone.
   * @param {number} radius       The radius in grid units.
   * @param {number} direction    The direction in degrees.
   * @param {number} angle        The angle in degrees.
   * @returns {Point[]}           The points of the cone polygon.
   */
  getCone(origin, radius, direction, angle) {
    if ( (radius <= 0) || (angle <= 0) ) return [];
    const circle = this.getCircle(origin, radius);
    if ( angle >= 360 ) return circle;
    const n = circle.length;
    const aMin = Math.normalizeRadians(Math.toRadians(direction - (angle / 2)));
    const aMax = aMin + Math.toRadians(angle);
    const pMin = {x: origin.x + (Math.cos(aMin) * this.size), y: origin.y + (Math.sin(aMin) * this.size)};
    const pMax = {x: origin.x + (Math.cos(aMax) * this.size), y: origin.y + (Math.sin(aMax) * this.size)};
    const angles = circle.map(p => {
      const a = Math.atan2(p.y - origin.y, p.x - origin.x);
      return a >= aMin ? a : a + (2 * Math.PI);
    });
    const points = [{x: origin.x, y: origin.y}];
    for ( let i = 0, c0 = circle[n - 1], a0 = angles[n - 1]; i < n; i++ ) {
      let c1 = circle[i];
      let a1 = angles[i];
      if ( a0 > a1 ) {
        const {x: x1, y: y1} = lineLineIntersection(c0, c1, origin, pMin);
        points.push({x: x1, y: y1});
        while ( a1 < aMax ) {
          points.push(c1);
          i = (i + 1) % n;
          c0 = c1;
          c1 = circle[i];
          a0 = a1;
          a1 = angles[i];
          if ( a0 > a1 ) break;
        }
        const {x: x2, y: y2} = lineLineIntersection(c0, c1, origin, pMax);
        points.push({x: x2, y: y2});
        break;
      }
      c0 = c1;
      a0 = a1;
    }
    return points;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getRect(w, h) {
    const msg = "BaseGrid#getRect is deprecated. If you need the size of a Token, use Token#getSize instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return new PIXI.Rectangle(0, 0, w * this.sizeX, h * this.sizeY);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  static calculatePadding(gridType, width, height, size, padding, options) {
    const msg = "BaseGrid.calculatePadding is deprecated in favor of BaseGrid#calculateDimensions.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    let grid;
    if ( gridType === GRID_TYPES.GRIDLESS ) {
      grid = new foundry.grid.GridlessGrid({size});
    } else if ( gridType === GRID_TYPES.SQUARE ) {
      grid = new foundry.grid.SquareGrid({size});
    } else if ( gridType.between(GRID_TYPES.HEXODDR, GRID_TYPES.HEXEVENQ) ) {
      const columns = (gridType === GRID_TYPES.HEXODDQ) || (gridType === GRID_TYPES.HEXEVENQ);
      if ( options?.legacy ) return HexagonalGrid._calculatePreV10Dimensions(columns, size,
        sceneWidth, sceneHeight, padding);
      grid = new foundry.grid.HexagonalGrid({
        columns,
        even: (gridType === GRID_TYPES.HEXEVENR) || (gridType === GRID_TYPES.HEXEVENQ),
        size
      });
    } else {
      throw new Error("Invalid grid type");
    }
    return grid.calculateDimensions(width, height, padding);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated
   * @ignore
   */
  get w() {
    const msg = "BaseGrid#w is deprecated in favor of BaseGrid#sizeX.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return this.sizeX;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  set w(value) {
    const msg = "BaseGrid#w is deprecated in favor of BaseGrid#sizeX.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    this.sizeX = value;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get h() {
    const msg = "BaseGrid#h is deprecated in favor of BaseGrid#sizeY.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return this.sizeY;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  set h(value) {
    const msg = "BaseGrid#h is deprecated in favor of BaseGrid#sizeY.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    this.sizeY = value;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getTopLeft(x, y) {
    const msg = "BaseGrid#getTopLeft is deprecated. Use BaseGrid#getTopLeftPoint instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    let [row, col] = this.getGridPositionFromPixels(x, y);
    return this.getPixelsFromGridPosition(row, col);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getCenter(x, y) {
    const msg = "BaseGrid#getCenter is deprecated. Use BaseGrid#getCenterPoint instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return [x, y];
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getNeighbors(row, col) {
    const msg = "BaseGrid#getNeighbors is deprecated. Use BaseGrid#getAdjacentOffsets instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return this.getAdjacentOffsets({i: row, j: col}).map(({i, j}) => [i, j]);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getGridPositionFromPixels(x, y) {
    const msg = "BaseGrid#getGridPositionFromPixels is deprecated. Use BaseGrid#getOffset instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return [y, x].map(Math.round);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getPixelsFromGridPosition(row, col) {
    const msg = "BaseGrid#getPixelsFromGridPosition is deprecated. Use BaseGrid#getTopLeftPoint instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return [col, row].map(Math.round);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  shiftPosition(x, y, dx, dy, options={}) {
    const msg = "BaseGrid#shiftPosition is deprecated. Use BaseGrid#getShiftedPoint instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return [x + (dx * this.size), y + (dy * this.size)];
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  measureDistances(segments, options={}) {
    const msg = "BaseGrid#measureDistances is deprecated. Use BaseGrid#measurePath instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return segments.map(s => {
      return (s.ray.distance / this.size) * this.distance;
    });
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getSnappedPosition(x, y, interval=null, options={}) {
    const msg = "BaseGrid#getSnappedPosition is deprecated. Use BaseGrid#getSnappedPoint instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    if ( interval === 0 ) return {x: Math.round(x), y: Math.round(y)};
    interval = interval ?? 1;
    return {
      x: Math.round(x.toNearest(this.sizeX / interval)),
      y: Math.round(y.toNearest(this.sizeY / interval))
    };
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  highlightGridPosition(layer, options) {
    const msg = "BaseGrid#highlightGridPosition is deprecated. Use GridLayer#highlightPosition instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    canvas.interface.grid.highlightPosition(layer.name, options);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get grid() {
    const msg = "canvas.grid.grid is deprecated. Use canvas.grid instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return this;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  isNeighbor(r0, c0, r1, c1) {
    const msg = "canvas.grid.isNeighbor is deprecated. Use canvas.grid.testAdjacency instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return this.testAdjacency({i: r0, j: c0}, {i: r1, j: c1});
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get isHex() {
    const msg = "canvas.grid.isHex is deprecated. Use of canvas.grid.isHexagonal instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return this.isHexagonal;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  measureDistance(origin, target, options={}) {
    const msg = "canvas.grid.measureDistance is deprecated. "
      + "Use canvas.grid.measurePath instead for non-Euclidean measurements.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    const ray = new Ray(origin, target);
    const segments = [{ray}];
    return this.measureDistances(segments, options)[0];
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get highlight() {
    const msg = "canvas.grid.highlight is deprecated. Use canvas.interface.grid.highlight instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return canvas.interface.grid.highlight;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get highlightLayers() {
    const msg = "canvas.grid.highlightLayers is deprecated. Use canvas.interface.grid.highlightLayers instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return canvas.interface.grid.highlightLayers;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  addHighlightLayer(name) {
    const msg = "canvas.grid.addHighlightLayer is deprecated. Use canvas.interface.grid.addHighlightLayer instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return canvas.interface.grid.addHighlightLayer(name);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  clearHighlightLayer(name) {
    const msg = "canvas.grid.clearHighlightLayer is deprecated. Use canvas.interface.grid.clearHighlightLayer instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    canvas.interface.grid.clearHighlightLayer(name);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  destroyHighlightLayer(name) {
    const msg = "canvas.grid.destroyHighlightLayer is deprecated. Use canvas.interface.grid.destroyHighlightLayer instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    canvas.interface.grid.destroyHighlightLayer(name);
  }

  /* -------------------------------------------- */


  /**
   * @deprecated since v12
   * @ignore
   */
  getHighlightLayer(name) {
    const msg = "canvas.grid.getHighlightLayer is deprecated. Use canvas.interface.grid.getHighlightLayer instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return canvas.interface.grid.getHighlightLayer(name);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  highlightPosition(name, options) {
    const msg = "canvas.grid.highlightPosition is deprecated. Use canvas.interface.grid.highlightPosition instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    canvas.interface.grid.highlightPosition(name, options);
  }
}
