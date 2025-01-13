/**
 * A Region is an implementation of PlaceableObject which represents a Region document
 * within a viewed Scene on the game canvas.
 * @category - Canvas
 * @see {RegionDocument}
 * @see {RegionLayer}
 */
class Region extends PlaceableObject {
  constructor(document) {
    super(document);
    this.#initialize();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  static embeddedName = "Region";

  /* -------------------------------------------- */

  /** @override */
  static RENDER_FLAGS = {
    redraw: {propagate: ["refresh"]},
    refresh: {propagate: ["refreshState", "refreshBorder"], alias: true},
    refreshState: {},
    refreshBorder: {}
  };

  /* -------------------------------------------- */

  static {
    /**
     * The scaling factor used for Clipper paths.
     * @type {number}
     */
    Object.defineProperty(this, "CLIPPER_SCALING_FACTOR", {value: 100});

    /**
     * The three movement segment types: ENTER, MOVE, and EXIT.
     * @enum {number}
     */
    Object.defineProperty(this, "MOVEMENT_SEGMENT_TYPES", {value: Object.freeze({
      /**
       * The segment crosses the boundary of the region and exits it.
       */
      EXIT: -1,

      /**
       * The segment does not cross the boundary of the region and is contained within it.
       */
      MOVE: 0,

      /**
       * The segment crosses the boundary of the region and enters it.
       */
      ENTER: 1
    })});
  }

  /* -------------------------------------------- */

  /**
   * A temporary point used by this class.
   * @type {PIXI.Point}
   */
  static #SHARED_POINT = new PIXI.Point();

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * The shapes of this Region in draw order.
   * @type {ReadonlyArray<RegionShape>}
   */
  get shapes() {
    return this.#shapes ??= this.document.shapes.map(shape => foundry.canvas.regions.RegionShape.create(shape));
  }

  #shapes;

  /* -------------------------------------------- */

  /**
   * The bottom elevation of this Region.
   * @type {number}
   */
  get bottom() {
    return this.document.elevation.bottom ?? -Infinity;
  }

  /* -------------------------------------------- */

  /**
   * The top elevation of this Region.
   * @type {number}
   */
  get top() {
    return this.document.elevation.top ?? Infinity;
  }

  /* -------------------------------------------- */

  /**
   * The polygons of this Region.
   * @type {ReadonlyArray<PIXI.Polygon>}
   */
  get polygons() {
    return this.#polygons ??= Array.from(this.polygonTree, node => node.polygon);
  }

  #polygons;

  /* -------------------------------------------- */

  /**
   * The polygon tree of this Region.
   * @type {RegionPolygonTree}
   */
  get polygonTree() {
    return this.#polygonTree ??= foundry.canvas.regions.RegionPolygonTree._fromClipperPolyTree(
      this.#createClipperPolyTree());
  }

  #polygonTree;

  /* -------------------------------------------- */

  /**
   * The Clipper paths of this Region.
   * @type {ReadonlyArray<ReadonlyArray<ClipperLib.IntPoint>>}
   */
  get clipperPaths() {
    return this.#clipperPaths ??= Array.from(this.polygonTree, node => node.clipperPath);
  }

  #clipperPaths;

  /* -------------------------------------------- */

  /**
   * The triangulation of this Region.
   * @type {Readonly<{vertices: Float32Array, indices: Uint16Array|Uint32Array}>}
   */
  get triangulation() {
    let triangulation = this.#triangulation;
    if ( !this.#triangulation ) {
      let vertexIndex = 0;
      let vertexDataSize = 0;
      for ( const node of this.polygonTree ) vertexDataSize += node.points.length;
      const vertexData = new Float32Array(vertexDataSize);
      const indices = [];
      for ( const node of this.polygonTree ) {
        if ( node.isHole ) continue;
        const holes = [];
        let points = node.points;
        for ( const hole of node.children ) {
          holes.push(points.length / 2);
          points = points.concat(hole.points);
        }
        const triangles = PIXI.utils.earcut(points, holes, 2);
        const offset = vertexIndex / 2;
        for ( let i = 0; i < triangles.length; i++ ) indices.push(triangles[i] + offset);
        for ( let i = 0; i < points.length; i++ ) vertexData[vertexIndex++] = points[i];
      }
      const indexDataType = vertexDataSize / 2 > 65536 ? Uint32Array : Uint16Array;
      const indexData = new indexDataType(indices);
      this.#triangulation = triangulation = {vertices: vertexData, indices: indexData};
    }
    return triangulation;
  }

  #triangulation;

  /* -------------------------------------------- */

  /**
   * The geometry of this Region.
   * @type {RegionGeometry}
   */
  get geometry() {
    return this.#geometry;
  }

  #geometry = new foundry.canvas.regions.RegionGeometry(this);

  /* -------------------------------------------- */

  /** @override */
  get bounds() {
    let bounds = this.#bounds;
    if ( !bounds ) {
      const nodes = this.polygonTree.children;
      if ( nodes.length === 0 ) bounds = new PIXI.Rectangle();
      else {
        bounds = nodes[0].bounds.clone();
        for ( let i = 1; i < nodes.length; i++ ) {
          bounds.enlarge(nodes[i].bounds);
        }
      }
      this.#bounds = bounds;
    }
    return bounds.clone(); // PlaceableObject#bounds always returns a new instance
  }

  #bounds;

  /* -------------------------------------------- */

  /** @override */
  get center() {
    const {x, y} = this.bounds.center;
    return new PIXI.Point(x, y);
  }

  /* -------------------------------------------- */

  /**
   * Is this Region currently visible on the Canvas?
   * @type {boolean}
   */
  get isVisible() {
    if ( this.sheet?.rendered ) return true;
    if ( !this.layer.legend._isRegionVisible(this) ) return false;
    const V = CONST.REGION_VISIBILITY;
    switch ( this.document.visibility ) {
      case V.LAYER: return this.layer.active;
      case V.GAMEMASTER: return game.user.isGM;
      case V.ALWAYS: return true;
      default: throw new Error("Invalid visibility");
    }
  }

  /* -------------------------------------------- */

  /**
   * The highlight of this Region.
   * @type {RegionMesh}
   */
  #highlight;

  /* -------------------------------------------- */

  /**
   * The border of this Region.
   * @type {PIXI.Graphics}
   */
  #border;

  /* -------------------------------------------- */

  /** @override */
  getSnappedPosition(position) {
    throw new Error("Region#getSnappedPosition is not supported: RegionDocument does not have a (x, y) position");
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Initialize the Region.
   */
  #initialize() {
    this.#updateShapes();
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _draw(options) {
    this.#highlight = this.addChild(new foundry.canvas.regions.RegionMesh(this, HighlightRegionShader));
    this.#highlight.eventMode = "auto";
    this.#highlight.shader.uniforms.hatchThickness = canvas.dimensions.size / 25;
    this.#highlight.alpha = 0.5;
    this.#border = this.addChild(new PIXI.Graphics());
    this.#border.eventMode = "none";
    this.cursor = "pointer";
  }

  /* -------------------------------------------- */
  /*  Incremental Refresh                         */
  /* -------------------------------------------- */

  /** @override */
  _applyRenderFlags(flags) {
    if ( flags.refreshState ) this._refreshState();
    if ( flags.refreshBorder ) this._refreshBorder();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the state of the Region.
   * @protected
   */
  _refreshState() {
    const wasVisible = this.visible;
    this.visible = this.isVisible;
    if ( this.visible !== wasVisible ) MouseInteractionManager.emulateMoveEvent();
    this.zIndex = this.controlled ? 2 : this.hover ? 1 : 0;
    const oldEventMode = this.eventMode;
    this.eventMode = this.layer.active && (game.activeTool === "select") ? "static" : "none";
    if ( this.eventMode !== oldEventMode ) MouseInteractionManager.emulateMoveEvent();
    const {locked, color} = this.document;
    this.#highlight.tint = color;
    this.#highlight.shader.uniforms.hatchEnabled = !this.controlled && !this.hover;
    const colors = CONFIG.Canvas.dispositionColors;
    this.#border.tint = this.controlled ? (locked ? colors.HOSTILE : colors.CONTROLLED) : colors.INACTIVE;
    this.#border.visible = this.controlled || this.hover || this.layer.highlightObjects;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the border of the Region.
   * @protected
   */
  _refreshBorder() {
    const thickness = CONFIG.Canvas.objectBorderThickness;
    this.#border.clear();
    for ( const lineStyle of [
      {width: thickness, color: 0x000000, join: PIXI.LINE_JOIN.ROUND, alignment: 0.75},
      {width: thickness / 2, color: 0xFFFFFF, join: PIXI.LINE_JOIN.ROUND, alignment: 1}
    ]) {
      this.#border.lineStyle(lineStyle);
      for ( const node of this.polygonTree ) {
        if ( node.isHole ) continue;
        this.#border.drawShape(node.polygon);
        this.#border.beginHole();
        for ( const hole of node.children ) this.#border.drawShape(hole.polygon);
        this.#border.endHole();
      }
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _canDrag(user, event) {
    return false; // Regions cannot be dragged
  }

  /* -------------------------------------------- */

  /** @override */
  _canHUD(user, event) {
    return false; // Regions don't have a HUD
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onControl(options) {
    super._onControl(options);
    this.layer.legend.render();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRelease(options) {
    super._onRelease(options);
    if ( this.layer.active ) {
      ui.controls.initialize({tool: "select"});
      this.layer.legend.render();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onHoverIn(event, {updateLegend=true, ...options}={}) {
    if ( updateLegend ) this.layer.legend._hoverRegion(this, true);
    return super._onHoverIn(event, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onHoverOut(event, {updateLegend=true, ...options}={}) {
    if ( updateLegend ) this.layer.legend._hoverRegion(this, false);
    return super._onHoverOut(event);
  }

  /* -------------------------------------------- */

  /** @override */
  _overlapsSelection(rectangle) {
    if ( !rectangle.intersects(this.bounds) ) return false;
    const scalingFactor = Region.CLIPPER_SCALING_FACTOR;
    const x0 = Math.round(rectangle.left * scalingFactor);
    const y0 = Math.round(rectangle.top * scalingFactor);
    const x1 = Math.round(rectangle.right * scalingFactor);
    const y1 = Math.round(rectangle.bottom * scalingFactor);
    if ( (x0 === x1) || (y0 === y1) ) return false;
    const rectanglePath = [
      new ClipperLib.IntPoint(x0, y0),
      new ClipperLib.IntPoint(x1, y0),
      new ClipperLib.IntPoint(x1, y1),
      new ClipperLib.IntPoint(x0, y1)
    ];
    const clipper = new ClipperLib.Clipper();
    const solution = [];
    clipper.Clear();
    clipper.AddPath(rectanglePath, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(this.clipperPaths, ClipperLib.PolyType.ptClip, true);
    clipper.Execute(ClipperLib.ClipType.ctIntersection, solution);
    return solution.length !== 0;
  }

  /* -------------------------------------------- */
  /*  Shape Methods                               */
  /* -------------------------------------------- */

  /**
   * Test whether the given point (at the given elevation) is inside this Region.
   * @param {Point} point           The point.
   * @param {number} [elevation]    The elevation of the point.
   * @returns {boolean}             Is the point (at the given elevation) inside this Region?
   */
  testPoint(point, elevation) {
    return ((elevation === undefined) || ((this.bottom <= elevation) && (elevation <= this.top)))
      && this.polygonTree.testPoint(point);
  }

  /* -------------------------------------------- */

  /**
   * Update the shapes of this region.
   */
  #updateShapes() {
    this.#shapes = undefined;
    this.#polygons = undefined;
    this.#polygonTree = undefined;
    this.#clipperPaths = undefined;
    this.#bounds = undefined;
    this.#triangulation = undefined;
    this.#geometry?._clearBuffers();
  }

  /* -------------------------------------------- */

  /**
   * Create the Clipper polygon tree for this Region.
   * @returns {ClipperLib.PolyTree}
   */
  #createClipperPolyTree() {
    const i0 = this.shapes.findIndex(s => !s.isHole);
    if ( i0 < 0 ) return new ClipperLib.PolyTree();
    if ( i0 === this.shapes.length - 1 ) {
      const shape = this.shapes[i0];
      if ( shape.isHole ) return new ClipperLib.PolyTree();
      return shape.clipperPolyTree;
    }
    const clipper = new ClipperLib.Clipper();
    const batches = this.#buildClipperBatches();
    if ( batches.length === 0 ) return new ClipperLib.PolyTree();
    if ( batches.length === 1 ) {
      const batch = batches[0];
      const tree = new ClipperLib.PolyTree();
      clipper.AddPaths(batch.paths, ClipperLib.PolyType.ptClip, true);
      clipper.Execute(batch.clipType, tree, ClipperLib.PolyFillType.pftNonZero, batch.fillType);
      return tree;
    }
    let subjectPaths = batches[0].paths;
    let subjectFillType = batches[0].fillType;
    for ( let i = 1; i < batches.length; i++ ) {
      const batch = batches[i];
      const solution = i === batches.length - 1 ? new ClipperLib.PolyTree() : [];
      clipper.Clear();
      clipper.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
      clipper.AddPaths(batch.paths, ClipperLib.PolyType.ptClip, true);
      clipper.Execute(batch.clipType, solution, subjectFillType, batch.fillType);
      subjectPaths = solution;
      subjectFillType = ClipperLib.PolyFillType.pftNonZero;
    }
    return subjectPaths;
  }

  /* -------------------------------------------- */

  /**
   * Build the Clipper batches.
   * @returns {{paths: ClipperLib.IntPoint[][], fillType: ClipperLib.PolyFillType, clipType: ClipperLib.ClipType}[]}
   */
  #buildClipperBatches() {
    const batches = [];
    const shapes = this.shapes;
    let i = 0;

    // Skip over holes at the beginning
    while ( i < shapes.length ) {
      if ( !shapes[i].isHole ) break;
      i++;
    }

    // Iterate the shapes and batch paths of consecutive (non-)hole shapes
    while ( i < shapes.length ) {
      const paths = [];
      const isHole = shapes[i].isHole;

      // Add paths of the current shape and following shapes until the next shape is (not) a hole
      do {
        for ( const path of shapes[i].clipperPaths ) paths.push(path);
        i++;
      } while ( (i < shapes.length) && (shapes[i].isHole === isHole) );

      // Create a batch from the paths, which are either all holes or all non-holes
      batches.push({
        paths,
        fillType: ClipperLib.PolyFillType.pftNonZero,
        clipType: isHole ? ClipperLib.ClipType.ctDifference : ClipperLib.ClipType.ctUnion
      });
    }
    return batches;
  }

  /* -------------------------------------------- */

  /**
   * @typedef {object} RegionMovementWaypoint
   * @property {number} x            The x-coordinates in pixels (integer).
   * @property {number} y            The y-coordinates in pixels (integer).
   * @property {number} elevation    The elevation in grid units.
   */

  /**
   * @typedef {object} RegionMovementSegment
   * @property {number} type                    The type of this segment (see {@link Region.MOVEMENT_SEGMENT_TYPES}).
   * @property {RegionMovementWaypoint} from    The waypoint that this segment starts from
   * @property {RegionMovementWaypoint} to      The waypoint that this segment goes to.
   */

  /**
   * Split the movement into its segments.
   * @param {RegionMovementWaypoint[]} waypoints    The waypoints of movement.
   * @param {Point[]} samples                       The points relative to the waypoints that are tested.
   *                                                Whenever one of them is inside the region, the moved object
   *                                                is considered to be inside the region.
   * @param {object} [options]                      Additional options
   * @param {boolean} [options.teleport=false]      Is it teleportation?
   * @returns {RegionMovementSegment[]}             The movement split into its segments.
   */
  segmentizeMovement(waypoints, samples, {teleport=false}={}) {
    if ( samples.length === 0 ) return [];
    let segments = [];
    for ( let i = 1; i < waypoints.length; i++ ) {
      for ( const segment of this.#segmentizeMovement(waypoints[i - 1], waypoints[i], samples, teleport) ) {
        segments.push(segment);
      }
    }
    return segments;
  }

  /* -------------------------------------------- */

  /**
   * Split the movement into its segments.
   * @param {RegionMovementWaypoint} origin         The origin of movement.
   * @param {RegionMovementWaypoint} destination    The destination of movement.
   * @param {Point[]} samples                       The points relative to the waypoints that are tested.
   * @param {boolean} teleport                      Is it teleportation?
   * @returns {RegionMovementSegment[]}             The movement split into its segments.
   */
  #segmentizeMovement(origin, destination, samples, teleport) {
    const originX = Math.round(origin.x);
    const originY = Math.round(origin.y);
    const originElevation = origin.elevation;
    const destinationX = Math.round(destination.x);
    const destinationY = Math.round(destination.y);
    const destinationElevation = destination.elevation;

    // If same origin and destination, there are no segments
    if ( (originX === destinationX) && (originY === destinationY)
      && (originElevation === destinationElevation) ) return [];

    // If teleport, move directly
    if ( teleport ) {
      const segment = this.#getTeleportationSegment(originX, originY, originElevation,
        destinationX, destinationY, destinationElevation, samples);
      return segment ? [segment] : [];
    }

    // If no elevation change, we don't have to deal with enter/exit segments at the bottom/top elevation range
    if ( originElevation === destinationElevation ) {
      if ( !((this.bottom <= originElevation) && (originElevation <= this.top)) ) return [];
      return this.#getMovementSegments(originX, originY, originElevation,
        destinationX, destinationY, destinationElevation, samples);
    }

    // Calculate the first and last elevation within the elevation range of this Region
    const upwards = originElevation < destinationElevation;
    const e1 = upwards ? Math.max(originElevation, this.bottom) : Math.min(originElevation, this.top);
    const e2 = upwards ? Math.min(destinationElevation, this.top) : Math.max(destinationElevation, this.bottom);
    const t1 = (e1 - originElevation) / (destinationElevation - originElevation);
    const t2 = (e2 - originElevation) / (destinationElevation - originElevation);

    // Return if there's no intersection
    if ( t1 > t2 ) return [];

    // Calculate the first and last position of movement in the elevation range of this Region
    const x1 = Math.round(Math.mix(originX, destinationX, t1));
    const y1 = Math.round(Math.mix(originY, destinationY, t1));
    const x2 = Math.round(Math.mix(originX, destinationX, t2));
    const y2 = Math.round(Math.mix(originY, destinationY, t2));

    // Get movements segments within the elevation range of this Region
    const segments = this.#getMovementSegments(x1, y1, e1, x2, y2, e2, samples);

    // Add segment if we enter vertically
    if ( (originElevation !== e1) && this.#testSamples(x1, y1, samples) ) {
      const grid = this.document.parent.grid;
      const epsilon = Math.min(Math.abs(originElevation - e1), grid.distance / grid.size);
      segments.unshift({
        type: Region.MOVEMENT_SEGMENT_TYPES.ENTER,
        from: {x: x1, y: y1, elevation: e1 - (upwards ? epsilon : -epsilon)},
        to: {x: x1, y: y1, elevation: e1}
      });
    }

    // Add segment if we exit vertically
    if ( (destinationElevation !== e2) && this.#testSamples(x2, y2, samples) ) {
      const grid = this.document.parent.grid;
      const epsilon = Math.min(Math.abs(destinationElevation - e2), grid.distance / grid.size);
      segments.push({
        type: Region.MOVEMENT_SEGMENT_TYPES.EXIT,
        from: {x: x2, y: y2, elevation: e2},
        to: {x: x2, y: y2, elevation: e2 + (upwards ? epsilon : -epsilon)}
      });
    }
    return segments;
  }

  /* -------------------------------------------- */

  /**
   * Get the teleporation segment from the origin to the destination.
   * @param {number} originX                  The x-coordinate of the origin.
   * @param {number} originY                  The y-coordinate of the origin.
   * @param {number} originElevation          The elevation of the destination.
   * @param {number} destinationX             The x-coordinate of the destination.
   * @param {number} destinationY             The y-coordinate of the destination.
   * @param {number} destinationElevation     The elevation of the destination.
   * @param {Point[]} samples                 The samples relative to the position.
   * @returns {RegionMovementSegment|void}    The teleportation segment, if any.
   */
  #getTeleportationSegment(originX, originY, originElevation, destinationX, destinationY, destinationElevation,
    samples) {
    const positionChanged = (originX !== destinationX) || (originY !== destinationY);
    const elevationChanged = originElevation !== destinationElevation;
    if ( !(positionChanged || elevationChanged) ) return;
    const {bottom, top} = this;
    let originInside = (bottom <= originElevation) && (originElevation <= top);
    let destinationInside = (bottom <= destinationElevation) && (destinationElevation <= top);
    if ( positionChanged ) {
      originInside &&= this.#testSamples(originX, originY, samples);
      destinationInside &&= this.#testSamples(destinationX, destinationY, samples);
    } else if ( originInside || destinationInside ) {
      const inside = this.#testSamples(originX, originY, samples);
      originInside &&= inside;
      destinationInside &&= inside;
    }
    let type;
    if ( originInside && destinationInside) type = Region.MOVEMENT_SEGMENT_TYPES.MOVE;
    else if ( originInside ) type = Region.MOVEMENT_SEGMENT_TYPES.EXIT;
    else if ( destinationInside ) type = Region.MOVEMENT_SEGMENT_TYPES.ENTER;
    else return;
    return {
      type,
      from: {x: originX, y: originY, elevation: originElevation},
      to: {x: destinationX, y: destinationY, elevation: destinationElevation}
    };
  }

  /* -------------------------------------------- */

  /**
   * Test whether one of the samples relative to the given position is contained within this Region.
   * @param {number} x           The x-coordinate of the position.
   * @param {number} y           The y-coordinate of the position.
   * @param {Point[]} samples    The samples relative to the position.
   * @returns {boolean}          Is one of the samples contained within this Region?
   */
  #testSamples(x, y, samples) {
    const point = Region.#SHARED_POINT;
    const n = samples.length;
    for ( let i = 0; i < n; i++ ) {
      const sample = samples[i];
      if ( this.#polygonTree.testPoint(point.set(x + sample.x, y + sample.y)) ) return true;
    }
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Split the movement into its segments.
   * @param {number} originX                 The x-coordinate of the origin.
   * @param {number} originY                 The y-coordinate of the origin.
   * @param {number} originElevation         The elevation of the destination.
   * @param {number} destinationX            The x-coordinate of the destination.
   * @param {number} destinationY            The y-coordinate of the destination.
   * @param {number} destinationElevation    The elevation of the destination.
   * @param {Point[]} samples                The samples relative to the position.
   * @returns {{start: number, end: number}[]}    The intervals where we have an intersection.
   */
  #getMovementSegments(originX, originY, originElevation, destinationX, destinationY, destinationElevation, samples) {
    const segments = [];
    if ( (originX === destinationX) && (originY === destinationY) ) {

      // Add move segment if inside and the elevation changed
      if ( (originElevation !== destinationElevation) && this.#testSamples(originX, originY, samples) ) {
        segments.push({
          type: Region.MOVEMENT_SEGMENT_TYPES.MOVE,
          from: {x: originX, y: originY, elevation: originElevation},
          to: {x: destinationX, y: destinationY, elevation: destinationElevation}
        });
      }
      return segments;
    }

    // Test first if the bounds of the movement overlap the bounds of this Region
    if ( !this.#couldMovementIntersect(originX, originY, destinationX, destinationY, samples) ) return segments;

    // Compute the intervals
    const intervals = this.#computeSegmentIntervals(originX, originY, destinationX, destinationY, samples);

    // Compute the segments from the intervals
    for ( const {start, end} of intervals ) {

      // Find crossings (enter and exit) for the interval
      const startX = Math.round(Math.mix(originX, destinationX, start));
      const startY = Math.round(Math.mix(originY, destinationY, start));
      const startElevation = Math.mix(originElevation, destinationElevation, start);
      const endX = Math.round(Math.mix(originX, destinationX, end));
      const endY = Math.round(Math.mix(originY, destinationY, end));
      const endElevation = Math.mix(originElevation, destinationElevation, end);
      const [{x: x00, y: y00, inside: inside00}, {x: x01, y: y01, inside: inside01}] = this.#findBoundaryCrossing(
        originX, originY, startX, startY, endX, endY, samples, true);
      const [{x: x10, y: y10, inside: inside10}, {x: x11, y: y11, inside: inside11}] = this.#findBoundaryCrossing(
        startX, startY, endX, endY, destinationX, destinationY, samples, false);

      // Add enter segment if found
      if ( inside00 !== inside01 ) {
        segments.push({
          type: Region.MOVEMENT_SEGMENT_TYPES.ENTER,
          from: {x: x00, y: y00, elevation: startElevation},
          to: {x: x01, y: y01, elevation: startElevation}
        });
      }

      // Add move segment or enter/exit segment if not completely inside
      if ( (inside01 || inside10) && ((x01 !== x10) || (y01 !== y10)) ) {
        segments.push({
          type: inside01 && inside10 ? Region.MOVEMENT_SEGMENT_TYPES.MOVE
            : inside10 ? Region.MOVEMENT_SEGMENT_TYPES.ENTER : Region.MOVEMENT_SEGMENT_TYPES.EXIT,
          from: {x: x01, y: y01, elevation: startElevation},
          to: {x: x10, y: y10, elevation: endElevation}
        });
      }

      // Add exit segment if found
      if ( inside10 !== inside11 ) {
        segments.push({
          type: Region.MOVEMENT_SEGMENT_TYPES.EXIT,
          from: {x: x10, y: y10, elevation: endElevation},
          to: {x: x11, y: y11, elevation: endElevation}
        });
      }
    }

    // Make sure we have segments for origins/destinations inside the region
    const originInside = this.#testSamples(originX, originY, samples);
    const destinationInside = this.#testSamples(destinationX, destinationY, samples);

    // If neither the origin nor the destination are inside, we are done
    if ( !originInside && !destinationInside ) return segments;

    // If we didn't find segments with the method above, we need to add segments for the origin and/or destination
    if ( segments.length === 0 ) {

      // If the origin is inside, look for a crossing (exit) after the origin
      if ( originInside ) {
        const [{x: x0, y: y0}, {x: x1, y: y1, inside: inside1}] = this.#findBoundaryCrossing(
          originX, originY, originX, originY, destinationX, destinationY, samples, false);
        if ( !inside1 ) {

          // If we don't exit at the origin, add a move segment
          if ( (originX !== x0) || (originY !== y0) ) {
            segments.push({
              type: Region.MOVEMENT_SEGMENT_TYPES.MOVE,
              from: {x: originX, y: originY, elevation: originElevation},
              to: {x: x0, y: y0, elevation: originElevation}
            });
          }

          // Add the exit segment that we found
          segments.push({
            type: Region.MOVEMENT_SEGMENT_TYPES.EXIT,
            from: {x: x0, y: y0, elevation: originElevation},
            to: {x: x1, y: y1, elevation: originElevation}
          });
        }
      }

      // If the destination is inside, look for a crossing (enter) before the destination
      if ( destinationInside ) {
        const [{x: x0, y: y0, inside: inside0}, {x: x1, y: y1}] = this.#findBoundaryCrossing(
          originX, originY, destinationX, destinationY, destinationX, destinationY, samples, true);
        if ( !inside0 ) {

          // Add the enter segment that we found
          segments.push({
            type: Region.MOVEMENT_SEGMENT_TYPES.ENTER,
            from: {x: x0, y: y0, elevation: destinationElevation},
            to: {x: x1, y: y1, elevation: destinationElevation}
          });

          // If we don't enter at the destination, add a move segment
          if ( (destinationX !== x1) || (destinationY !== y1) ) {
            segments.push({
              type: Region.MOVEMENT_SEGMENT_TYPES.MOVE,
              from: {x: x1, y: y1, elevation: destinationElevation},
              to: {x: destinationX, y: destinationY, elevation: destinationElevation}
            });
          }
        }
      }

      // If both are inside and we didn't find we didn't find a crossing, the entire segment is contained
      if ( originInside && destinationInside && (segments.length === 0) ) {
        segments.push({
          type: Region.MOVEMENT_SEGMENT_TYPES.MOVE,
          from: {x: originX, y: originY, elevation: originElevation},
          to: {x: destinationX, y: destinationY, elevation: destinationElevation}
        });
      }
    }

    // We have segments and know we make sure that the origin and/or destination that are inside are
    // part of those segments. If they are not we either need modify the first/last segment or add
    // segments to the beginning/end.
    else {

      // Make sure we have a segment starting at the origin if it is inside
      if ( originInside ) {
        const first = segments.at(0);
        const {x: firstX, y: firstY} = first.from;
        if ( (originX !== firstX) || (originY !== firstY) ) {

          // The first segment is an enter segment, so we need to add an exit segment before this one
          if ( first.type === 1 ) {
            const [{x: x0, y: y0}, {x: x1, y: y1}] = this.#findBoundaryCrossing(
              firstX, firstY, originX, originY, originX, originY, samples, false);
            segments.unshift({
              type: Region.MOVEMENT_SEGMENT_TYPES.EXIT,
              from: {x: x0, y: y0, elevation: originElevation},
              to: {x: x1, y: y1, elevation: originElevation}
            });
          }

          // We have an exit or move segment, in which case we can simply update the from position
          else {
            first.from.x = originX;
            first.from.y = originY;
          }
        }
      }

      // Make sure we have a segment ending at the destination if it is inside
      if ( destinationInside ) {
        const last = segments.at(-1);
        const {x: lastX, y: lastY} = last.to;
        if ( (destinationX !== lastX) || (destinationY !== lastY) ) {

          // The last segment is an exit segment, so we need to add an enter segment after this one
          if ( last.type === -1 ) {
            const [{x: x0, y: y0}, {x: x1, y: y1}] = this.#findBoundaryCrossing(
              lastX, lastY, destinationX, destinationY, destinationX, destinationY, samples, true);
            segments.push({
              type: Region.MOVEMENT_SEGMENT_TYPES.ENTER,
              from: {x: x0, y: y0, elevation: destinationElevation},
              to: {x: x1, y: y1, elevation: destinationElevation}
            });
          }

          // We have an enter or move segment, in which case we can simply update the to position
          else {
            last.to.x = destinationX;
            last.to.y = destinationY;
          }
        }
      }
    }
    return segments;
  }

  /* -------------------------------------------- */

  /**
   * Test whether the movement could intersect this Region.
   * @param {number} originX         The x-coordinate of the origin.
   * @param {number} originY         The y-coordinate of the origin.
   * @param {number} destinationX    The x-coordinate of the destination.
   * @param {number} destinationY    The y-coordinate of the destination.
   * @param {Point[]} samples        The samples relative to the position.
   * @returns {boolean}              Could the movement intersect?
   */
  #couldMovementIntersect(originX, originY, destinationX, destinationY, samples) {
    let {x: minX, y: minY} = samples[0];
    let maxX = minX;
    let maxY = minY;
    for ( let i = 1; i < samples.length; i++ ) {
      const {x, y} = samples[i];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    minX += Math.min(originX, destinationX);
    minY += Math.min(originY, destinationY);
    maxX += Math.max(originX, destinationX);
    maxY += Math.max(originY, destinationY);
    const {left, right, top, bottom} = this.bounds;
    return (Math.max(minX, left - 1) <= Math.min(maxX, right + 1))
      && (Math.max(minY, top - 1) <= Math.min(maxY, bottom + 1));
  }

  /* -------------------------------------------- */

  /**
   * Compute the intervals of intersection of the movement.
   * @param {number} originX         The x-coordinate of the origin.
   * @param {number} originY         The y-coordinate of the origin.
   * @param {number} destinationX    The x-coordinate of the destination.
   * @param {number} destinationY    The y-coordinate of the destination.
   * @param {Point[]} samples        The samples relative to the position.
   * @returns {{start: number, end: number}[]}    The intervals where we have an intersection.
   */
  #computeSegmentIntervals(originX, originY, destinationX, destinationY, samples) {
    const scalingFactor = Region.CLIPPER_SCALING_FACTOR;
    const intervals = [];
    const clipper = new ClipperLib.Clipper();
    const solution = new ClipperLib.PolyTree();
    const origin = new ClipperLib.IntPoint(0, 0);
    const destination = new ClipperLib.IntPoint(0, 0);
    const lineSegment = [origin, destination];

    // Calculate the intervals for each of the line segments
    for ( const {x: dx, y: dy} of samples ) {
      origin.X = Math.round((originX + dx) * scalingFactor);
      origin.Y = Math.round((originY + dy) * scalingFactor);
      destination.X = Math.round((destinationX + dx) * scalingFactor);
      destination.Y = Math.round((destinationY + dy) * scalingFactor);

      // Intersect the line segment with the geometry of this Region
      clipper.Clear();
      clipper.AddPath(lineSegment, ClipperLib.PolyType.ptSubject, false);
      clipper.AddPaths(this.clipperPaths, ClipperLib.PolyType.ptClip, true);
      clipper.Execute(ClipperLib.ClipType.ctIntersection, solution);

      // Calculate the intervals of the intersections
      const length = Math.hypot(destination.X - origin.X, destination.Y - origin.Y);
      for ( const [a, b] of ClipperLib.Clipper.PolyTreeToPaths(solution) ) {
        let start = Math.hypot(a.X - origin.X, a.Y - origin.Y) / length;
        let end = Math.hypot(b.X - origin.X, b.Y - origin.Y) / length;
        if ( start > end ) [start, end] = [end, start];
        intervals.push({start, end});
      }
    }

    // Sort and merge intervals
    intervals.sort((i0, i1) => i0.start - i1.start);
    const mergedIntervals = [];
    if ( intervals.length !== 0 ) {
      let i0 = intervals[0];
      mergedIntervals.push(i0);
      for ( let i = 1; i < intervals.length; i++ ) {
        const i1 = intervals[i];
        if ( i0.end < i1.start ) mergedIntervals.push(i0 = i1);
        else i0.end = Math.max(i0.end, i1.end);
      }
    }
    return mergedIntervals;
  }

  /* -------------------------------------------- */

  /**
   * Find the crossing (enter or exit) at the current position between the start and end position, if possible.
   * The current position should be very close to crossing, otherwise we test a lot of pixels potentially.
   * We use Bresenham's line algorithm to walk forward/backwards to find the crossing.
   * @see {@link https://en.wikipedia.org/wiki/Bresenham's_line_algorithm}
   * @param {number} startX      The start x-coordinate.
   * @param {number} startY      The start y-coordinate.
   * @param {number} currentX    The current x-coordinate.
   * @param {number} currentY    The current y-coordinate.
   * @param {number} endX        The end x-coordinate.
   * @param {number} endY        The end y-coordinate.
   * @param {boolean} samples    The samples.
   * @param {boolean} enter      Find enter? Otherwise find exit.
   * @returns {[from: {x: number, y: number, inside: boolean}, to: {x: number, y: number, inside: boolean}]}
   */
  #findBoundaryCrossing(startX, startY, currentX, currentY, endX, endY, samples, enter) {
    let x0 = currentX;
    let y0 = currentY;
    let x1 = x0;
    let y1 = y0;
    let x2;
    let y2;

    // Adjust starting conditions depending on whether we are already inside the Region
    const inside = this.#testSamples(currentX, currentY, samples);
    if ( inside === enter ) {
      x2 = startX;
      y2 = startY;
    } else {
      x2 = endX;
      y2 = endY;
    }
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    const dx = Math.abs(x1 - x2);
    const dy = 0 - Math.abs(y1 - y2);
    let e = dx + dy;

    // Iterate until we find a crossing point or we reach the start/end position
    while ( (x1 !== x2) || (y1 !== y2) ) {
      const e2 = e * 2;
      if ( e2 <= dx ) {
        e += dx;
        y1 += sy;
      }
      if ( e2 >= dy ) {
        e += dy;
        x1 += sx;
      }

      // If we found the crossing, return it
      if ( this.#testSamples(x1, y1, samples) !== inside ) {
        return inside === enter
          ? [{x: x1, y: y1, inside: !inside}, {x: x0, y: y0, inside}]
          : [{x: x0, y: y0, inside}, {x: x1, y: y1, inside: !inside}];
      }

      x0 = x1;
      y0 = y1;
    }
    return [{x: x1, y: y1, inside}, {x: x1, y: y1, inside}];
  }

  /* -------------------------------------------- */
  /*  Document Event Handlers                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    // Update the shapes
    if ( "shapes" in changed ) this.#updateShapes();

    // Incremental Refresh
    this.renderFlags.set({
      refreshState: ("color" in changed) || ("visibility" in changed) || ("locked" in changed),
      refreshBorder: "shapes" in changed
    });
  }
}
