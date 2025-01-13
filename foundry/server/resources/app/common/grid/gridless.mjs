import BaseGrid from "./base.mjs";
import {GRID_TYPES, MOVEMENT_DIRECTIONS} from "../constants.mjs";

/**
 * The gridless grid class.
 */
export default class GridlessGrid extends BaseGrid {

  /** @override */
  type = GRID_TYPES.GRIDLESS;

  /* -------------------------------------------- */

  /** @override */
  calculateDimensions(sceneWidth, sceneHeight, padding) {
    // Note: Do not replace `* (1 / this.size)` by `/ this.size`!
    // It could change the result and therefore break certain scenes.
    const x = Math.ceil((padding * sceneWidth) * (1 / this.size)) * this.size;
    const y = Math.ceil((padding * sceneHeight) * (1 / this.size)) * this.size;
    const width = sceneWidth + (2 * x);
    const height = sceneHeight + (2 * y);
    return {width, height, x, y, rows: Math.ceil(height), columns: Math.ceil(width)};
  }

  /* -------------------------------------------- */

  /** @override */
  getOffset(coords) {
    const i = coords.i;
    if ( i !== undefined ) return {i, j: coords.j};
    return {i: Math.round(coords.y) | 0, j: Math.round(coords.x) | 0};
  }

  /* -------------------------------------------- */

  /** @override */
  getOffsetRange({x, y, width, height}) {
    const i0 = Math.floor(y);
    const j0 = Math.floor(x);
    if ( !((width > 0) && (height > 0)) ) return [i0, j0, i0, j0];
    return [i0, j0, Math.ceil(y + height) | 0, Math.ceil(x + width) | 0];
  }

  /* -------------------------------------------- */

  /** @override */
  getAdjacentOffsets(coords) {
    return [];
  }

  /* -------------------------------------------- */

  /** @override */
  testAdjacency(coords1, coords2) {
    return false;
  }

  /* -------------------------------------------- */

  /** @override */
  getShiftedOffset(coords, direction) {
    const i = coords.i;
    if ( i !== undefined ) coords = {x: coords.j, y: i};
    return this.getOffset(this.getShiftedPoint(coords, direction));
  }

  /* -------------------------------------------- */

  /** @override */
  getShiftedPoint(point, direction) {
    let di = 0;
    let dj = 0;
    if ( direction & MOVEMENT_DIRECTIONS.UP ) di--;
    if ( direction & MOVEMENT_DIRECTIONS.DOWN ) di++;
    if ( direction & MOVEMENT_DIRECTIONS.LEFT ) dj--;
    if ( direction & MOVEMENT_DIRECTIONS.RIGHT ) dj++;
    return {x: point.x + (dj * this.size), y: point.y + (di * this.size)};
  }

  /* -------------------------------------------- */

  /** @override */
  getTopLeftPoint(coords) {
    const i = coords.i;
    if ( i !== undefined ) return {x: coords.j, y: i};
    return {x: coords.x, y: coords.y};
  }

  /* -------------------------------------------- */

  /** @override */
  getCenterPoint(coords) {
    const i = coords.i;
    if ( i !== undefined ) return {x: coords.j, y: i};
    return {x: coords.x, y: coords.y};
  }

  /* -------------------------------------------- */

  /** @override */
  getShape() {
    return [];
  }

  /* -------------------------------------------- */

  /** @override */
  getVertices(coords) {
    return [];
  }

  /* -------------------------------------------- */

  /** @override */
  getSnappedPoint({x, y}, behavior) {
    return {x, y};
  }

  /* -------------------------------------------- */

  /** @override */
  _measurePath(waypoints, {cost}, result) {
    result.distance = 0;
    result.spaces = 0;
    result.cost = 0;

    if ( waypoints.length === 0 ) return;

    const from = result.waypoints[0];
    from.distance = 0;
    from.spaces = 0;
    from.cost = 0;

    // Prepare data for the starting point
    const w0 = waypoints[0];
    let o0 = this.getOffset(w0);
    let p0 = this.getCenterPoint(w0);

    // Iterate over additional path points
    for ( let i = 1; i < waypoints.length; i++ ) {
      const w1 = waypoints[i];
      const o1 = this.getOffset(w1);
      const p1 = this.getCenterPoint(w1);

      // Measure segment
      const to = result.waypoints[i];
      const segment = to.backward;
      if ( !w1.teleport ) {

        // Calculate the Euclidean distance
        segment.distance = Math.hypot(p0.x - p1.x, p0.y - p1.y) / this.size * this.distance;
        segment.spaces = 0;
        const offsetDistance = Math.hypot(o0.i - o1.i, o0.j - o1.j) / this.size * this.distance;
        segment.cost = cost && (offsetDistance !== 0) ? cost(o0, o1, offsetDistance) : offsetDistance;
      } else {
        segment.distance = 0;
        segment.spaces = 0;
        segment.cost = cost && ((o0.i !== o1.i) || (o0.j !== o1.j)) ? cost(o0, o1, 0) : 0;
      }

      // Accumulate measurements
      result.distance += segment.distance;
      result.cost += segment.cost;

      // Set waypoint measurements
      to.distance = result.distance;
      to.spaces = 0;
      to.cost = result.cost;

      o0 = o1;
      p0 = p1;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  getDirectPath(waypoints) {
    if ( waypoints.length === 0 ) return [];
    let o0 = this.getOffset(waypoints[0]);
    const path = [o0];
    for ( let i = 1; i < waypoints.length; i++ ) {
      const o1 = this.getOffset(waypoints[i]);
      if ( (o0.i === o1.i) && (o0.j === o1.j) ) continue;
      path.push(o1);
      o0 = o1;
    }
    return path;
  }

  /* -------------------------------------------- */

  /** @override */
  getTranslatedPoint(point, direction, distance) {
    direction = Math.toRadians(direction);
    const dx = Math.cos(direction);
    const dy = Math.sin(direction);
    const s = distance / this.distance * this.size;
    return {x: point.x + (dx * s), y: point.y + (dy * s)};
  }

  /* -------------------------------------------- */

  /** @override */
  getCircle({x, y}, radius) {
    if ( radius <= 0 ) return [];
    const r = radius / this.distance * this.size;
    const n = Math.max(Math.ceil(Math.PI / Math.acos(Math.max(r - 0.25, 0) / r)), 4);
    const points = new Array(n);
    for ( let i = 0; i < n; i++ ) {
      const a = 2 * Math.PI * (i / n);
      points[i] = {x: x + (Math.cos(a) * r), y: y + (Math.sin(a) * r)};
    }
    return points;
  }

  /* -------------------------------------------- */

  /** @override */
  getCone(origin, radius, direction, angle) {
    if ( (radius <= 0) || (angle <= 0) ) return [];
    if ( angle >= 360 ) return this.getCircle(origin, radius);
    const r = radius / this.distance * this.size;
    const n = Math.max(Math.ceil(Math.PI / Math.acos(Math.max(r - 0.25, 0) / r) * (angle / 360)), 4);
    const a0 = Math.toRadians(direction - (angle / 2));
    const a1 = Math.toRadians(direction + (angle / 2));
    const points = new Array(n + 1);
    const {x, y} = origin;
    points[0] = {x, y};
    for ( let i = 0; i <= n; i++ ) {
      const a = Math.mix(a0, a1, i / n);
      points[i + 1] = {x: x + (Math.cos(a) * r), y: y + (Math.sin(a) * r)};
    }
    return points;
  }
}
