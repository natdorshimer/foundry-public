import BaseGrid from "./base.mjs";
import {GRID_DIAGONALS, GRID_TYPES, MOVEMENT_DIRECTIONS} from "../constants.mjs";
import {logCompatibilityWarning} from "../utils/logging.mjs";

/**
 * @typedef {object} _SquareGridConfiguration
 * @property {number} [diagonals=CONST.GRID_DIAGONALS.EQUIDISTANT]  The rule for diagonal measurement
 *                                                                  (see {@link CONST.GRID_DIAGONALS})
 */

/**
 * @typedef {GridConfiguration&_SquareGridConfiguration} SquareGridConfiguration
 */

/**
 * An offset of a grid space or a point with pixel coordinates.
 * @typedef {GridCoordinates} SquareGridCoordinates
 */

/**
 * The square grid class.
 */
export default class SquareGrid extends BaseGrid {
  /**
   * The square grid constructor.
   * @param {SquareGridConfiguration} config   The grid configuration
   */
  constructor(config) {
    super(config);

    this.type = GRID_TYPES.SQUARE;

    /**
     * The rule for diagonal measurement (see {@link CONST.GRID_DIAGONALS}).
     * @type {number}
     */
    this.diagonals = config.diagonals ?? GRID_DIAGONALS.EQUIDISTANT;
  }

  /* -------------------------------------------- */

  /**
   * Returns the offset of the grid space corresponding to the given coordinates.
   * @param {SquareGridCoordinates} coords    The coordinates
   * @returns {GridOffset}                    The offset
   */
  getOffset(coords) {
    let i = coords.i;
    let j;
    if ( i !== undefined ) {
      j = coords.j;
    } else {
      j = Math.floor(coords.x / this.size);
      i = Math.floor(coords.y / this.size);
    }
    return {i, j};
  }

  /* -------------------------------------------- */

  /** @override */
  getOffsetRange({x, y, width, height}) {
    const i0 = Math.floor(y / this.size);
    const j0 = Math.floor(x / this.size);
    if ( !((width > 0) && (height > 0)) ) return [i0, j0, i0, j0];
    return [i0, j0, Math.ceil((y + height) / this.size) | 0, Math.ceil((x + width) / this.size) | 0];
  }

  /* -------------------------------------------- */

  /** @override */
  getAdjacentOffsets(coords) {
    const {i, j} = this.getOffset(coords);

    // Non-diagonals
    const offsets = [
      {i: i - 1, j},
      {i, j: j + 1},
      {i: i + 1, j},
      {i, j: j - 1}
    ];
    if ( this.diagonals === GRID_DIAGONALS.ILLEGAL ) return offsets;

    // Diagonals
    offsets.push(
      {i: i - 1, j: j - 1},
      {i: i - 1, j: j + 1},
      {i: i + 1, j: j + 1},
      {i: i + 1, j: j - 1}
    );
    return offsets;
  }

  /* -------------------------------------------- */

  /** @override */
  testAdjacency(coords1, coords2) {
    const {i: i1, j: j1} = this.getOffset(coords1);
    const {i: i2, j: j2} = this.getOffset(coords2);
    const di = Math.abs(i1 - i2);
    const dj = Math.abs(j1 - j2);
    const diagonals = this.diagonals !== GRID_DIAGONALS.ILLEGAL;
    return diagonals ? Math.max(di, dj) === 1 : (di + dj) === 1;
  }

  /* -------------------------------------------- */

  /** @override */
  getShiftedOffset(coords, direction) {
    let di = 0;
    let dj = 0;
    if ( direction & MOVEMENT_DIRECTIONS.UP ) di--;
    if ( direction & MOVEMENT_DIRECTIONS.DOWN ) di++;
    if ( direction & MOVEMENT_DIRECTIONS.LEFT ) dj--;
    if ( direction & MOVEMENT_DIRECTIONS.RIGHT ) dj++;
    if ( di && dj && (this.diagonals === GRID_DIAGONALS.ILLEGAL) ) {
      // Diagonal movement is not allowed
      di = 0;
      dj = 0;
    }
    const offset = this.getOffset(coords);
    offset.i += di;
    offset.j += dj;
    return offset;
  }

  /* -------------------------------------------- */

  /** @override */
  getShiftedPoint(point, direction) {
    const topLeft = this.getTopLeftPoint(point);
    const shifted = this.getTopLeftPoint(this.getShiftedOffset(topLeft, direction));
    shifted.x = point.x + (shifted.x - topLeft.x);
    shifted.y = point.y + (shifted.y - topLeft.y);
    return shifted;
  }

  /* -------------------------------------------- */

  /**
   * Returns the top-left point of the grid space corresponding to the given coordinates.
   * If given a point, the top-left point of the grid space that contains it is returned.
   * @param {SquareGridCoordinates} coords    The coordinates
   * @returns {Point}                         The top-left point
   */
  getTopLeftPoint(coords) {
    let i = coords.i;
    let j;
    if ( i !== undefined ) {
      j = coords.j;
    } else {
      j = Math.floor(coords.x / this.size);
      i = Math.floor(coords.y / this.size);
    }
    return {x: j * this.size, y: i * this.size};
  }

  /* -------------------------------------------- */

  /**
   * Returns the center point of the grid space corresponding to the given coordinates.
   * If given a point, the center point of the grid space that contains it is returned.
   * @param {SquareGridCoordinates} coords    The coordinates
   * @returns {Point}                         The center point
   */
  getCenterPoint(coords) {
    const point = this.getTopLeftPoint(coords);
    const halfSize = this.size / 2;
    point.x += halfSize;
    point.y += halfSize;
    return point;
  }

  /* -------------------------------------------- */

  /** @override */
  getShape() {
    const s = this.size / 2;
    return [{x: -s, y: -s}, {x: s, y: -s}, {x: s, y: s}, {x: -s, y: s}];
  }

  /* -------------------------------------------- */

  /** @override */
  getVertices(coords) {
    const {i, j} = this.getOffset(coords);
    const x0 = j * this.size;
    const x1 = (j + 1) * this.size;
    const y0 = i * this.size;
    const y1 = (i + 1) * this.size;
    return [{x: x0, y: y0}, {x: x1, y: y0}, {x: x1, y: y1}, {x: x0, y: y1}];
  }

  /* -------------------------------------------- */

  /** @override */
  getSnappedPoint(point, {mode, resolution=1}) {
    if ( mode & ~0xFFF3 ) throw new Error("Invalid snapping mode");
    if ( mode === 0 ) return {x: point.x, y: point.y};

    let nearest;
    let distance;
    const keepNearest = candidate => {
      if ( !nearest ) return nearest = candidate;
      const {x, y} = point;
      distance ??= ((nearest.x - x) ** 2) + ((nearest.y - y) ** 2);
      const d = ((candidate.x - x) ** 2) + ((candidate.y - y) ** 2);
      if ( d < distance ) {
        nearest = candidate;
        distance = d;
      }
      return nearest;
    };

    // Any edge = Any side
    if ( !(mode & 0x2) ) {
      // Horizontal (Top/Bottom) side + Vertical (Left/Right) side = Any edge
      if ( (mode & 0x3000) && (mode & 0xC000) ) mode |= 0x2;
      // Horizontal (Top/Bottom) side
      else if ( mode & 0x3000 ) keepNearest(this.#snapToTopOrBottom(point, resolution));
      // Vertical (Left/Right) side
      else if ( mode & 0xC000 ) keepNearest(this.#snapToLeftOrRight(point, resolution));
    }

    // With vertices (= corners)
    if ( mode & 0xFF0 ) {
      switch ( mode & ~0xFFF0 ) {
        case 0x0: keepNearest(this.#snapToVertex(point, resolution)); break;
        case 0x1: keepNearest(this.#snapToVertexOrCenter(point, resolution)); break;
        case 0x2: keepNearest(this.#snapToEdgeOrVertex(point, resolution)); break;
        case 0x3: keepNearest(this.#snapToEdgeOrVertexOrCenter(point, resolution)); break;
      }
    }
    // Without vertices
    else {
      switch ( mode & ~0xFFF0 ) {
        case 0x1: keepNearest(this.#snapToCenter(point, resolution)); break;
        case 0x2: keepNearest(this.#snapToEdge(point, resolution)); break;
        case 0x3: keepNearest(this.#snapToEdgeOrCenter(point, resolution)); break;
      }
    }

    return nearest;
  }

  /* -------------------------------------------- */

  /**
   * Snap the point to the nearest center of a square.
   * @param {Point} point          The point
   * @param {number} resolution    The grid resolution
   * @returns {Point}              The snapped point
   */
  #snapToCenter({x, y}, resolution) {
    const s = this.size / resolution;
    const t = this.size / 2;
    return {
      x: (Math.round((x - t) / s) * s) + t,
      y: (Math.round((y - t) / s) * s) + t
    };
  }

  /* -------------------------------------------- */

  /**
   * Snap the point to the nearest vertex of a square.
   * @param {Point} point          The point
   * @param {number} resolution    The grid resolution
   * @returns {Point}              The snapped point
   */
  #snapToVertex({x, y}, resolution) {
    const s = this.size / resolution;
    const t = this.size / 2;
    return {
      x: ((Math.ceil((x - t) / s) - 0.5) * s) + t,
      y: ((Math.ceil((y - t) / s) - 0.5) * s) + t
    };
  }

  /* -------------------------------------------- */

  /**
   * Snap the point to the nearest vertex or center of a square.
   * @param {Point} point          The point
   * @param {number} resolution    The grid resolution
   * @returns {Point}              The snapped point
   */
  #snapToVertexOrCenter({x, y}, resolution) {
    const s = this.size / resolution;
    const t = this.size / 2;
    const c0 = (x - t) / s;
    const r0 = (y - t) / s;
    const c1 = Math.round(c0 + r0);
    const r1 = Math.round(r0 - c0);
    return {
      x: ((c1 - r1) * s / 2) + t,
      y: ((c1 + r1) * s / 2) + t
    };
  }

  /* -------------------------------------------- */

  /**
   * Snap the point to the nearest edge of a square.
   * @param {Point} point          The point
   * @param {number} resolution    The grid resolution
   * @returns {Point}              The snapped point
   */
  #snapToEdge({x, y}, resolution) {
    const s = this.size / resolution;
    const t = this.size / 2;
    const c0 = (x - t) / s;
    const r0 = (y - t) / s;
    const c1 = Math.floor(c0 + r0);
    const r1 = Math.floor(r0 - c0);
    return {
      x: ((c1 - r1) * s / 2) + t,
      y: ((c1 + r1 + 1) * s / 2) + t
    };
  }

  /* -------------------------------------------- */

  /**
   * Snap the point to the nearest edge or center of a square.
   * @param {Point} point          The point
   * @param {number} resolution    The grid resolution
   * @returns {Point}              The snapped point
   */
  #snapToEdgeOrCenter({x, y}, resolution) {
    const s = this.size / resolution;
    const t = this.size / 2;
    const c0 = (x - t) / s;
    const r0 = (y - t) / s;
    const x0 = (Math.round(c0) * s) + t;
    const y0 = (Math.round(r0) * s) + t;
    if ( Math.max(Math.abs(x - x0), Math.abs(y - y0)) <= s / 4 ) {
      return {x: x0, y: y0};
    }
    const c1 = Math.floor(c0 + r0);
    const r1 = Math.floor(r0 - c0);
    return {
      x: ((c1 - r1) * s / 2) + t,
      y: ((c1 + r1 + 1) * s / 2) + t
    };
  }

  /* -------------------------------------------- */

  /**
   * Snap the point to the nearest edge or vertex of a square.
   * @param {Point} point          The point
   * @param {number} resolution    The grid resolution
   * @returns {Point}              The snapped point
   */
  #snapToEdgeOrVertex({x, y}, resolution) {
    const s = this.size / resolution;
    const t = this.size / 2;
    const c0 = (x - t) / s;
    const r0 = (y - t) / s;
    const x0 = ((Math.floor(c0) + 0.5) * s) + t;
    const y0 = ((Math.floor(r0) + 0.5) * s) + t;
    if ( Math.max(Math.abs(x - x0), Math.abs(y - y0)) <= s / 4 ) {
      return {x: x0, y: y0};
    }
    const c1 = Math.floor(c0 + r0);
    const r1 = Math.floor(r0 - c0);
    return {
      x: ((c1 - r1) * s / 2) + t,
      y: ((c1 + r1 + 1) * s / 2) + t
    };
  }

  /* -------------------------------------------- */

  /**
   * Snap the point to the nearest edge, vertex, or center of a square.
   * @param {Point} point          The point
   * @param {number} resolution    The grid resolution
   * @returns {Point}              The snapped point
   */
  #snapToEdgeOrVertexOrCenter({x, y}, resolution) {
    const s = this.size / (resolution * 2);
    return {
      x: Math.round(x / s) * s,
      y: Math.round(y / s) * s
    };
  }

  /* -------------------------------------------- */

  /**
   * Snap the point to the nearest top/bottom side of a square.
   * @param {Point} point          The point
   * @param {number} resolution    The grid resolution
   * @returns {Point}              The snapped point
   */
  #snapToTopOrBottom({x, y}, resolution) {
    const s = this.size / resolution;
    const t = this.size / 2;
    return {
      x: (Math.round((x - t) / s) * s) + t,
      y: ((Math.ceil((y - t) / s) - 0.5) * s) + t
    };
  }

  /* -------------------------------------------- */

  /**
   * Snap the point to the nearest left/right side of a square.
   * @param {Point} point          The point
   * @param {number} resolution    The grid resolution
   * @returns {Point}              The snapped point
   */
  #snapToLeftOrRight({x, y}, resolution) {
    const s = this.size / resolution;
    const t = this.size / 2;
    return {
      x: ((Math.ceil((x - t) / s) - 0.5) * s) + t,
      y: (Math.round((y - t) / s) * s) + t
    };
  }

  /* -------------------------------------------- */

  /**
   * @typedef {object} _SquareGridMeasurePathResultWaypoint
   * @property {number} diagonals    The total number of diagonals moved along a direct path up to this waypoint.
   */

  /**
   * @typedef {GridMeasurePathResultWaypoint & _SquareGridMeasurePathResultWaypoint} SquareGridMeasurePathResultWaypoint
   */

  /**
   * @typedef {object} _SquareGridMeasurePathResultWaypoint
   * @property {number} diagonals    The number of diagonals moved along this segment.
   */

  /**
   * @typedef {GridMeasurePathResultWaypoint & _SquareGridMeasurePathResultWaypoint} SquareGridMeasurePathResultWaypoint
   */

  /**
   * @typedef {object} _SquareGridMeasurePathResult
   * @property {number} diagonals    The total number of diagonals moved along a direct path through all waypoints.
   */

  /**
   * @typedef {GridMeasurePathResult & _SquareGridMeasurePathResult} SquareGridMeasurePathResult
   */

  /**
   * Measure a shortest, direct path through the given waypoints.
   * @function measurePath
   * @memberof SquareGrid
   * @instance
   *
   * @param {GridMeasurePathWaypoint[]} waypoints           The waypoints the path must pass through
   * @param {object} [options]                              Additional measurement options
   * @param {GridMeasurePathCostFunction} [options.cost]    The function that returns the cost
   *   for a given move between grid spaces (default is the distance travelled)
   * @returns {SquareGridMeasurePathResult}    The measurements a shortest, direct path through the given waypoints.
   */

  /** @override */
  _measurePath(waypoints, {cost}, result) {
    result.distance = 0;
    result.spaces = 0;
    result.cost = 0;
    result.diagonals = 0;

    if ( waypoints.length === 0 ) return;

    const from = result.waypoints[0];
    from.distance = 0;
    from.spaces = 0;
    from.cost = 0;
    from.diagonals = 0;

    // Convert to point coordiantes
    const toPoint = coords => {
      if ( coords.x !== undefined ) return coords;
      return this.getCenterPoint(coords);
    };

    // Prepare data for the starting point
    const w0 = waypoints[0];
    let o0 = this.getOffset(w0);
    let p0 = toPoint(w0);

    // Iterate over additional path points
    const diagonals = this.diagonals;
    let da = 0;
    let db = 0;
    let l0 = 0;
    for ( let i = 1; i < waypoints.length; i++ ) {
      const w1 = waypoints[i];
      const o1 = this.getOffset(w1);
      const p1 = toPoint(w1);

      // Measure segment
      const to = result.waypoints[i];
      const segment = to.backward;
      if ( !w1.teleport ) {
        const di = Math.abs(o0.i - o1.i);
        const dj = Math.abs(o0.j - o1.j);
        const ns = Math.abs(di - dj); // The number of straight moves
        let nd = Math.min(di, dj); // The number of diagonal moves
        let n = ns + nd; // The number of moves total

        // Determine the offset distance of the diagonal moves
        let cd;
        switch ( diagonals ) {
          case GRID_DIAGONALS.EQUIDISTANT: cd = nd; break;
          case GRID_DIAGONALS.EXACT: cd = Math.SQRT2 * nd; break;
          case GRID_DIAGONALS.APPROXIMATE: cd = 1.5 * nd; break;
          case GRID_DIAGONALS.RECTILINEAR: cd = 2 * nd; break;
          case GRID_DIAGONALS.ALTERNATING_1:
            if ( result.diagonals & 1 ) cd = ((nd + 1) & -2) + (nd >> 1);
            else cd = (nd & -2) + ((nd + 1) >> 1);
            break;
          case GRID_DIAGONALS.ALTERNATING_2:
            if ( result.diagonals & 1 ) cd = (nd & -2) + ((nd + 1) >> 1);
            else cd = ((nd + 1) & -2) + (nd >> 1);
            break;
          case GRID_DIAGONALS.ILLEGAL:
            cd = 2 * nd;
            nd = 0;
            n = di + dj;
            break;
        }

        // Determine the distance of the segment
        const dx = Math.abs(p0.x - p1.x) / this.size;
        const dy = Math.abs(p0.y - p1.y) / this.size;
        let l;
        switch ( diagonals ) {
          case GRID_DIAGONALS.EQUIDISTANT: l = Math.max(dx, dy); break;
          case GRID_DIAGONALS.EXACT: l = Math.max(dx, dy) + ((Math.SQRT2 - 1) * Math.min(dx, dy)); break;
          case GRID_DIAGONALS.APPROXIMATE: l = Math.max(dx, dy) + (0.5 * Math.min(dx, dy)); break;
          case GRID_DIAGONALS.ALTERNATING_1:
          case GRID_DIAGONALS.ALTERNATING_2:
            {
              const a = da += Math.max(dx, dy);
              const b = db += Math.min(dx, dy);
              const c = Math.floor(b / 2);
              const d = b - (2 * c);
              const e = Math.min(d, 1);
              const f = Math.max(d, 1) - 1;
              const l1 = a - b + (3 * c) + e + f + (diagonals === GRID_DIAGONALS.ALTERNATING_1 ? f : e);
              l = l1 - l0;
              l0 = l1;
            }
            break;
          case GRID_DIAGONALS.RECTILINEAR:
          case GRID_DIAGONALS.ILLEGAL: l = dx + dy; break;
        }
        if ( l.almostEqual(ns + cd) ) l = ns + cd;

        // Calculate the distance: the cost of the straight moves plus the cost of the diagonal moves
        segment.distance = l * this.distance;
        segment.spaces = n;
        segment.cost = cost ? this.#calculateCost(o0, o1, cost, result.diagonals) : (ns + cd) * this.distance;
        segment.diagonals = nd;
      } else {
        segment.distance = 0;
        segment.spaces = 0;
        segment.cost = cost && ((o0.i !== o1.i) || (o0.j !== o1.j)) ? cost(o0, o1, 0) : 0;
        segment.diagonals = 0;
      }

      // Accumulate measurements
      result.distance += segment.distance;
      result.spaces += segment.spaces;
      result.cost += segment.cost;
      result.diagonals += segment.diagonals;

      // Set waypoint measurements
      to.distance = result.distance;
      to.spaces = result.spaces;
      to.cost = result.cost;
      to.diagonals = result.diagonals;

      o0 = o1;
      p0 = p1;
    }
  }

  /* -------------------------------------------- */

  /**
   * Calculate the cost of the direct path segment.
   * @param {GridOffset} from     The coordinates the segment starts from
   * @param {GridOffset} to       The coordinates the segment goes to
   * @param {GridMeasurePathCostFunction} cost    The cost function
   * @param {number} diagonals    The number of diagonal moves that have been performed already
   * @returns {number}            The cost of the path segment
   */
  #calculateCost(from, to, cost, diagonals) {
    const path = this.getDirectPath([from, to]);
    if ( path.length <= 1 ) return 0;

    // Prepare data for the starting point
    let o0 = path[0];
    let c = 0;

    // Iterate over additional path points
    for ( let i = 1; i < path.length; i++ ) {
      const o1 = path[i];

      // Determine the normalized distance
      let k;
      if ( (o0.i === o1.i) || (o0.j === o1.j) ) k = 1;
      else {
        switch ( this.diagonals ) {
          case GRID_DIAGONALS.EQUIDISTANT: k = 1; break;
          case GRID_DIAGONALS.EXACT: k = Math.SQRT2; break;
          case GRID_DIAGONALS.APPROXIMATE: k = 1.5; break;
          case GRID_DIAGONALS.RECTILINEAR: k = 2; break;
          case GRID_DIAGONALS.ALTERNATING_1: k = diagonals & 1 ? 2 : 1; break;
          case GRID_DIAGONALS.ALTERNATING_2: k = diagonals & 1 ? 1 : 2; break;
        }
        diagonals++;
      }

      // Calculate and accumulate the cost
      c += cost(o0, o1, k * this.distance);

      o0 = o1;
    }

    return c;
  }

  /* -------------------------------------------- */

  /**
   * @see {@link https://en.wikipedia.org/wiki/Bresenham's_line_algorithm}
   * @override
   */
  getDirectPath(waypoints) {
    if ( waypoints.length === 0 ) return [];

    // Prepare data for the starting point
    const o0 = this.getOffset(waypoints[0]);
    let {i: i0, j: j0} = o0;
    const path = [o0];

    // Iterate over additional path points
    const diagonals = this.diagonals !== GRID_DIAGONALS.ILLEGAL;
    for ( let i = 1; i < waypoints.length; i++ ) {
      const o1 = this.getOffset(waypoints[i]);
      const {i: i1, j: j1} = o1;
      if ( (i0 === i1) && (j0 === j1) ) continue;

      // Walk from (r0, c0) to (r1, c1)
      const di = Math.abs(i0 - i1);
      const dj = 0 - Math.abs(j0 - j1);
      const si = i0 < i1 ? 1 : -1;
      const sj = j0 < j1 ? 1 : -1;
      let e = di + dj;
      for ( ;; ) {
        const e2 = e * 2;
        if ( diagonals ) {
          if ( e2 >= dj ) {
            e += dj;
            i0 += si;
          }
          if ( e2 <= di ) {
            e += di;
            j0 += sj;
          }
        } else {
          if ( e2 - dj >= di - e2 ) {
            e += dj;
            i0 += si;
          } else {
            e += di;
            j0 += sj;
          }
        }
        if ( (i0 === i1) && (j0 === j1) ) break;
        path.push({i: i0, j: j0});
      }
      path.push(o1);

      i0 = i1;
      j0 = j1;
    }

    return path;
  }

  /* -------------------------------------------- */

  /** @override */
  getTranslatedPoint(point, direction, distance) {
    direction = Math.toRadians(direction);
    const dx = Math.cos(direction);
    const dy = Math.sin(direction);
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    let s = distance / this.distance;
    switch ( this.diagonals ) {
      case GRID_DIAGONALS.EQUIDISTANT: s /= Math.max(adx, ady); break;
      case GRID_DIAGONALS.EXACT: s /= (Math.max(adx, ady) + ((Math.SQRT2 - 1) * Math.min(adx, ady))); break;
      case GRID_DIAGONALS.APPROXIMATE: s /= (Math.max(adx, ady) + (0.5 * Math.min(adx, ady))); break;
      case GRID_DIAGONALS.ALTERNATING_1:
        {
          let a = Math.max(adx, ady);
          const b = Math.min(adx, ady);
          const t = (2 * a) + b;
          let k = Math.floor(s * b / t);
          if ( (s * b) - (k * t) > a ) {
            a += b;
            k = -1 - k;
          }
          s = (s - k) / a;
        }
        break;
      case GRID_DIAGONALS.ALTERNATING_2:
        {
          let a = Math.max(adx, ady);
          const b = Math.min(adx, ady);
          const t = (2 * a) + b;
          let k = Math.floor(s * b / t);
          if ( (s * b) - (k * t) > a + b ) {
            k += 1;
          } else {
            a += b;
            k = -k;
          }
          s = (s - k) / a;
        }
        break;
      case GRID_DIAGONALS.RECTILINEAR:
      case GRID_DIAGONALS.ILLEGAL: s /= (adx + ady); break;
    }
    s *= this.size;
    return {x: point.x + (dx * s), y: point.y + (dy * s)};
  }

  /* -------------------------------------------- */

  /** @override */
  getCircle(center, radius) {
    if ( radius <= 0 ) return [];
    switch ( this.diagonals ) {
      case GRID_DIAGONALS.EQUIDISTANT: return this.#getCircleEquidistant(center, radius);
      case GRID_DIAGONALS.EXACT: return this.#getCircleExact(center, radius);
      case GRID_DIAGONALS.APPROXIMATE: return this.#getCircleApproximate(center, radius);
      case GRID_DIAGONALS.ALTERNATING_1: return this.#getCircleAlternating(center, radius, false);
      case GRID_DIAGONALS.ALTERNATING_2: return this.#getCircleAlternating(center, radius, true);
      case GRID_DIAGONALS.RECTILINEAR:
      case GRID_DIAGONALS.ILLEGAL: return this.#getCircleRectilinear(center, radius);
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the circle polygon given the radius in grid units (EQUIDISTANT).
   * @param {Point} center     The center point of the circle.
   * @param {number} radius    The radius in grid units (positive).
   * @returns {Point[]}        The points of the circle polygon.
   */
  #getCircleEquidistant({x, y}, radius) {
    const r = radius / this.distance * this.size;
    const x0 = x + r;
    const x1 = x - r;
    const y0 = y + r;
    const y1 = y - r;
    return [{x: x0, y: y0}, {x: x1, y: y0}, {x: x1, y: y1}, {x: x0, y: y1}];
  }

  /* -------------------------------------------- */

  /**
   * Get the circle polygon given the radius in grid units (EXACT).
   * @param {Point} center     The center point of the circle.
   * @param {number} radius    The radius in grid units (positive).
   * @returns {Point[]}        The points of the circle polygon.
   */
  #getCircleExact({x, y}, radius) {
    const r = radius / this.distance * this.size;
    const s = r / Math.SQRT2;
    return [
      {x: x + r, y},
      {x: x + s, y: y + s},
      {x: x, y: y + r },
      {x: x - s, y: y + s},
      {x: x - r, y},
      {x: x - s, y: y - s},
      {x: x, y: y - r},
      {x: x + s, y: y - s}
    ];
  }

  /* -------------------------------------------- */

  /**
   * Get the circle polygon given the radius in grid units (APPROXIMATE).
   * @param {Point} center     The center point of the circle.
   * @param {number} radius    The radius in grid units (positive).
   * @returns {Point[]}        The points of the circle polygon.
   */
  #getCircleApproximate({x, y}, radius) {
    const r = radius / this.distance * this.size;
    const s = r / 1.5;
    return [
      {x: x + r, y},
      {x: x + s, y: y + s},
      {x: x, y: y + r },
      {x: x - s, y: y + s},
      {x: x - r, y},
      {x: x - s, y: y - s},
      {x: x, y: y - r},
      {x: x + s, y: y - s}
    ];
  }

  /* -------------------------------------------- */

  /**
   * Get the circle polygon given the radius in grid units (ALTERNATING_1/2).
   * @param {Point} center           The center point of the circle.
   * @param {number} radius          The radius in grid units (positive).
   * @param {boolean} firstDouble    2/1/2 instead of 1/2/1?
   * @returns {Point[]}              The points of the circle polygon.
   */
  #getCircleAlternating(center, radius, firstDouble) {
    const r = radius / this.distance;
    const points = [];
    let dx = 0;
    let dy = 0;

    // Generate points of the first quarter
    if ( firstDouble ) {
      points.push({x: r - dx, y: dy});
      dx++;
      dy++;
    }
    for ( ;; ) {
      if ( r - dx < dy ) {
        [dx, dy] = [dy - 1, dx - 1];
        break;
      }
      points.push({x: r - dx, y: dy});
      dy++;
      if ( r - dx < dy ) {
        points.push({x: r - dx, y: r - dx});
        if ( dx === 0 ) dy = 0;
        else {
          points.push({x: dy - 1, y: r - dx});
          [dx, dy] = [dy - 2, dx - 1];
        }
        break;
      }
      points.push({x: r - dx, y: dy});
      dx++;
      dy++;
    }
    for ( ;; ) {
      if ( dx === 0 ) break;
      points.push({x: dx, y: r - dy});
      dx--;
      if ( dx === 0 ) break;
      points.push({x: dx, y: r - dy});
      dx--;
      dy--;
    }

    // Generate the points of the other three quarters by mirroring the first
    const n = points.length;
    for ( let i = 0; i < n; i++ ) {
      const p = points[i];
      points.push({x: -p.y, y: p.x});
    }
    for ( let i = 0; i < n; i++ ) {
      const p = points[i];
      points.push({x: -p.x, y: -p.y});
    }
    for ( let i = 0; i < n; i++ ) {
      const p = points[i];
      points.push({x: p.y, y: -p.x});
    }

    // Scale and center the polygon points
    for ( let i = 0; i < 4 * n; i++ ) {
      const p = points[i];
      p.x = (p.x * this.size) + center.x;
      p.y = (p.y * this.size) + center.y;
    }
    return points;
  }

  /* -------------------------------------------- */

  /**
   * Get the circle polygon given the radius in grid units (RECTILINEAR/ILLEGAL).
   * @param {Point} center     The center point of the circle.
   * @param {number} radius    The radius in grid units (positive).
   * @returns {Point[]}        The points of the circle polygon.
   */
  #getCircleRectilinear({x, y}, radius) {
    const r = radius / this.distance * this.size;
    return [{x: x + r, y}, {x, y: y + r}, {x: x - r, y}, {x, y: y - r}];
  }

  /* -------------------------------------------- */

  /** @override */
  calculateDimensions(sceneWidth, sceneHeight, padding) {
    // Note: Do not replace `* (1 / this.size)` by `/ this.size`!
    // It could change the result and therefore break certain scenes.
    const x = Math.ceil((padding * sceneWidth) * (1 / this.size)) * this.size;
    const y = Math.ceil((padding * sceneHeight) * (1 / this.size)) * this.size;
    const width = sceneWidth + (2 * x);
    const height = sceneHeight + (2 * y);
    const rows = Math.ceil((height / this.size) - 1e-6);
    const columns = Math.ceil((width / this.size) - 1e-6);
    return {width, height, x, y, rows, columns};
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getCenter(x, y) {
    const msg = "SquareGrid#getCenter is deprecated. Use SquareGrid#getCenterPoint instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return this.getTopLeft(x, y).map(c => c + (this.size / 2));
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getSnappedPosition(x, y, interval=1, options={}) {
    const msg = "SquareGrid#getSnappedPosition is deprecated. "
      + "Use BaseGrid#getSnappedPoint instead for non-Euclidean measurements.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    if ( interval === 0 ) return {x: Math.round(x), y: Math.round(y)};
    let [x0, y0] = this.#getNearestVertex(x, y);
    let dx = 0;
    let dy = 0;
    if ( interval !== 1 ) {
      let delta = this.size / interval;
      dx = Math.round((x - x0) / delta) * delta;
      dy = Math.round((y - y0) / delta) * delta;
    }
    return {
      x: Math.round(x0 + dx),
      y: Math.round(y0 + dy)
    };
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  #getNearestVertex(x, y) {
    return [x.toNearest(this.size), y.toNearest(this.size)];
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getGridPositionFromPixels(x, y) {
    const msg = "BaseGrid#getGridPositionFromPixels is deprecated. Use BaseGrid#getOffset instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return [Math.floor(y / this.size), Math.floor(x / this.size)];
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getPixelsFromGridPosition(row, col) {
    const msg = "BaseGrid#getPixelsFromGridPosition is deprecated. Use BaseGrid#getTopLeftPoint instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return [col * this.size, row * this.size];
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  shiftPosition(x, y, dx, dy, options={}) {
    const msg = "BaseGrid#shiftPosition is deprecated. Use BaseGrid#getShiftedPoint instead.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    let [row, col] = this.getGridPositionFromPixels(x, y);
    return this.getPixelsFromGridPosition(row+dy, col+dx);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  measureDistances(segments, options={}) {
    const msg = "SquareGrid#measureDistances is deprecated. "
      + "Use BaseGrid#measurePath instead for non-Euclidean measurements.";
    logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    if ( !options.gridSpaces ) return super.measureDistances(segments, options);
    return segments.map(s => {
      let r = s.ray;
      let nx = Math.abs(Math.ceil(r.dx / this.size));
      let ny = Math.abs(Math.ceil(r.dy / this.size));

      // Determine the number of straight and diagonal moves
      let nd = Math.min(nx, ny);
      let ns = Math.abs(ny - nx);

      // Linear distance for all moves
      return (nd + ns) * this.distance;
    });
  }
}
