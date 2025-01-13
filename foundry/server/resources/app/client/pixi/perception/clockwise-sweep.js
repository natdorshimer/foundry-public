/**
 * @typedef {Map<number,PolygonVertex>} VertexMap
 */

/**
 * @typedef {Set<Edge>} EdgeSet
 */

/**
 * @typedef {Ray} PolygonRay
 * @property {CollisionResult} result
 */

/**
 * A PointSourcePolygon implementation that uses CCW (counter-clockwise) geometry orientation.
 * Sweep around the origin, accumulating collision points based on the set of active walls.
 * This algorithm was created with valuable contributions from https://github.com/caewok
 *
 * @extends PointSourcePolygon
 */
class ClockwiseSweepPolygon extends PointSourcePolygon {

  /**
   * A mapping of vertices which define potential collision points
   * @type {VertexMap}
   */
  vertices = new Map();

  /**
   * The set of edges which define potential boundaries of the polygon
   * @type {EdgeSet}
   */
  edges = new Set();

  /**
   * A collection of rays which are fired at vertices
   * @type {PolygonRay[]}
   */
  rays = [];

  /**
   * The squared maximum distance of a ray that is needed for this Scene.
   * @type {number}
   */
  #rayDistance2;

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  initialize(origin, config) {
    super.initialize(origin, config);
    this.#rayDistance2 = Math.pow(canvas.dimensions.maxR, 2);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  clone() {
    const poly = super.clone();
    for ( const attr of ["vertices", "edges", "rays", "#rayDistance2"] ) { // Shallow clone only
      poly[attr] = this[attr];
    }
    return poly;
  }

  /* -------------------------------------------- */
  /*  Computation                                 */
  /* -------------------------------------------- */

  /** @inheritdoc */
  _compute() {

    // Clear prior data
    this.points = [];
    this.rays = [];
    this.vertices.clear();
    this.edges.clear();

    // Step 1 - Identify candidate edges
    this._identifyEdges();

    // Step 2 - Construct vertex mapping
    this._identifyVertices();

    // Step 3 - Radial sweep over endpoints
    this._executeSweep();

    // Step 4 - Constrain with boundary shapes
    this._constrainBoundaryShapes();
  }

  /* -------------------------------------------- */
  /*  Edge Configuration                          */
  /* -------------------------------------------- */

  /**
   * Get the super-set of walls which could potentially apply to this polygon.
   * Define a custom collision test used by the Quadtree to obtain candidate Walls.
   * @protected
   */
  _identifyEdges() {
    const bounds = this.config.boundingBox = this._defineBoundingBox();
    const edgeTypes = this._determineEdgeTypes();
    for ( const edge of canvas.edges.values() ) {
      if ( this._testEdgeInclusion(edge, edgeTypes, bounds) ) {
        this.edges.add(edge.clone());
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Determine the edge types and their manner of inclusion for this polygon instance.
   * @returns {Record<EdgeTypes, 0|1|2>}
   * @protected
   */
  _determineEdgeTypes() {
    const {type, useInnerBounds, includeDarkness} = this.config;
    const edgeTypes = {};
    if ( type !== "universal" ) edgeTypes.wall = 1;
    if ( includeDarkness ) edgeTypes.darkness = 1;
    if ( useInnerBounds && canvas.scene.padding ) edgeTypes.innerBounds = 2;
    else edgeTypes.outerBounds = 2;
    return edgeTypes;
  }

  /* -------------------------------------------- */

  /**
   * Test whether a wall should be included in the computed polygon for a given origin and type
   * @param {Edge} edge                     The Edge being considered
   * @param {Record<EdgeTypes, 0|1|2>} edgeTypes Which types of edges are being used? 0=no, 1=maybe, 2=always
   * @param {PIXI.Rectangle} bounds         The overall bounding box
   * @returns {boolean}                     Should the edge be included?
   * @protected
   */
  _testEdgeInclusion(edge, edgeTypes, bounds) {
    const { type, boundaryShapes, useThreshold, wallDirectionMode, externalRadius } = this.config;

    // Only include edges of the appropriate type
    const m = edgeTypes[edge.type];
    if ( !m ) return false;
    if ( m === 2 ) return true;

    // Test for inclusion in the overall bounding box
    if ( !bounds.lineSegmentIntersects(edge.a, edge.b, { inside: true }) ) return false;

    // Specific boundary shapes may impose additional requirements
    for ( const shape of boundaryShapes ) {
      if ( shape._includeEdge && !shape._includeEdge(edge.a, edge.b) ) return false;
    }

    // Ignore edges which do not block this polygon type
    if ( edge[type] === CONST.WALL_SENSE_TYPES.NONE ) return false;

    // Ignore edges which are collinear with the origin
    const side = edge.orientPoint(this.origin);
    if ( !side ) return false;

    // Ignore one-directional walls which are facing away from the origin
    const wdm = PointSourcePolygon.WALL_DIRECTION_MODES;
    if ( edge.direction && (wallDirectionMode !== wdm.BOTH) ) {
      if ( (wallDirectionMode === wdm.NORMAL) === (side === edge.direction) ) return false;
    }

    // Ignore threshold walls which do not satisfy their required proximity
    if ( useThreshold ) return !edge.applyThreshold(type, this.origin, externalRadius);
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Compute the aggregate bounding box which is the intersection of all boundary shapes.
   * Round and pad the resulting rectangle by 1 pixel to ensure it always contains the origin.
   * @returns {PIXI.Rectangle}
   * @protected
   */
  _defineBoundingBox() {
    let b = this.config.useInnerBounds ? canvas.dimensions.sceneRect : canvas.dimensions.rect;
    for ( const shape of this.config.boundaryShapes ) {
      b = b.intersection(shape.getBounds());
    }
    return new PIXI.Rectangle(b.x, b.y, b.width, b.height).normalize().ceil().pad(1);
  }

  /* -------------------------------------------- */
  /*  Vertex Identification                       */
  /* -------------------------------------------- */

  /**
   * Consolidate all vertices from identified edges and register them as part of the vertex mapping.
   * @protected
   */
  _identifyVertices() {
    const edgeMap = new Map();
    for ( let edge of this.edges ) {
      edgeMap.set(edge.id, edge);

      // Create or reference vertex A
      const ak = foundry.canvas.edges.PolygonVertex.getKey(edge.a.x, edge.a.y);
      if ( this.vertices.has(ak) ) edge.vertexA = this.vertices.get(ak);
      else {
        edge.vertexA = new foundry.canvas.edges.PolygonVertex(edge.a.x, edge.a.y);
        this.vertices.set(ak, edge.vertexA);
      }

      // Create or reference vertex B
      const bk = foundry.canvas.edges.PolygonVertex.getKey(edge.b.x, edge.b.y);
      if ( this.vertices.has(bk) ) edge.vertexB = this.vertices.get(bk);
      else {
        edge.vertexB = new foundry.canvas.edges.PolygonVertex(edge.b.x, edge.b.y);
        this.vertices.set(bk, edge.vertexB);
      }

      // Learn edge orientation with respect to the origin and ensure B is clockwise of A
      const o = foundry.utils.orient2dFast(this.origin, edge.vertexA, edge.vertexB);
      if ( o > 0 ) Object.assign(edge, {vertexA: edge.vertexB, vertexB: edge.vertexA}); // Reverse vertices
      if ( o !== 0 ) { // Attach non-collinear edges
        edge.vertexA.attachEdge(edge, -1, this.config.type);
        edge.vertexB.attachEdge(edge, 1, this.config.type);
      }
    }

    // Add edge intersections
    this._identifyIntersections(edgeMap);
  }

  /* -------------------------------------------- */

  /**
   * Add additional vertices for intersections between edges.
   * @param {Map<string, Edge>} edgeMap
   * @protected
   */
  _identifyIntersections(edgeMap) {
    const processed = new Set();
    for ( let edge of this.edges ) {
      for ( const x of edge.intersections ) {

        // Is the intersected edge also included in the polygon?
        const other = edgeMap.get(x.edge.id);
        if ( !other || processed.has(other) ) continue;
        const i = x.intersection;

        // Register the intersection point as a vertex
        const vk = foundry.canvas.edges.PolygonVertex.getKey(Math.round(i.x), Math.round(i.y));
        let v = this.vertices.get(vk);
        if ( !v ) {
          v = new foundry.canvas.edges.PolygonVertex(i.x, i.y);
          v._intersectionCoordinates = i;
          this.vertices.set(vk, v);
        }

        // Attach edges to the intersection vertex
        // Due to rounding, it is possible for an edge to be completely cw or ccw or only one of the two
        // We know from _identifyVertices that vertex B is clockwise of vertex A for every edge.
        // It is important that we use the true intersection coordinates (i) for this orientation test.
        if ( !v.edges.has(edge) ) {
          const dir = foundry.utils.orient2dFast(this.origin, edge.vertexB, i) < 0 ? 1    // Edge is fully CCW of v
            : (foundry.utils.orient2dFast(this.origin, edge.vertexA, i) > 0 ? -1 : 0);    // Edge is fully CW of v
          v.attachEdge(edge, dir, this.config.type);
        }
        if ( !v.edges.has(other) ) {
          const dir = foundry.utils.orient2dFast(this.origin, other.vertexB, i) < 0 ? 1   // Other is fully CCW of v
            : (foundry.utils.orient2dFast(this.origin, other.vertexA, i) > 0 ? -1 : 0);   // Other is fully CW of v
          v.attachEdge(other, dir, this.config.type);
        }
      }
      processed.add(edge);
    }
  }

  /* -------------------------------------------- */
  /*  Radial Sweep                                */
  /* -------------------------------------------- */

  /**
   * Execute the sweep over wall vertices
   * @private
   */
  _executeSweep() {

    // Initialize the set of active walls
    const activeEdges = this._initializeActiveEdges();

    // Sort vertices from clockwise to counter-clockwise and begin the sweep
    const vertices = this._sortVertices();

    // Iterate through the vertices, adding polygon points
    let i = 1;
    for ( const vertex of vertices ) {
      if ( vertex._visited ) continue;
      vertex._index = i++;
      this.#updateActiveEdges(vertex, activeEdges);

      // Include collinear vertices in this iteration of the sweep, treating their edges as active also
      const hasCollinear = vertex.collinearVertices.size > 0;
      if ( hasCollinear ) {
        this.#includeCollinearVertices(vertex, vertex.collinearVertices);
        for ( const cv of vertex.collinearVertices ) {
          cv._index = i++;
          this.#updateActiveEdges(cv, activeEdges);
        }
      }

      // Determine the result of the sweep for the given vertex
      this._determineSweepResult(vertex, activeEdges, hasCollinear);
    }
  }

  /* -------------------------------------------- */

  /**
   * Include collinear vertices until they have all been added.
   * Do not include the original vertex in the set.
   * @param {PolygonVertex} vertex  The current vertex
   * @param {PolygonVertexSet} collinearVertices
   */
  #includeCollinearVertices(vertex, collinearVertices) {
    for ( const cv of collinearVertices) {
      for ( const ccv of cv.collinearVertices ) {
        collinearVertices.add(ccv);
      }
    }
    collinearVertices.delete(vertex);
  }

  /* -------------------------------------------- */

  /**
   * Update active edges at a given vertex
   * Remove counter-clockwise edges which have now concluded.
   * Add clockwise edges which are ongoing or beginning.
   * @param {PolygonVertex} vertex   The current vertex
   * @param {EdgeSet} activeEdges    A set of currently active edges
   */
  #updateActiveEdges(vertex, activeEdges) {
    for ( const ccw of vertex.ccwEdges ) {
      if ( !vertex.cwEdges.has(ccw) ) activeEdges.delete(ccw);
    }
    for ( const cw of vertex.cwEdges ) {
      if ( cw.vertexA._visited && cw.vertexB._visited ) continue; // Safeguard in case we have already visited the edge
      activeEdges.add(cw);
    }
    vertex._visited = true; // Record that we have already visited this vertex
  }

  /* -------------------------------------------- */

  /**
   * Determine the initial set of active edges as those which intersect with the initial ray
   * @returns {EdgeSet}             A set of initially active edges
   * @private
   */
  _initializeActiveEdges() {
    const initial = {x: Math.round(this.origin.x - this.#rayDistance2), y: this.origin.y};
    const edges = new Set();
    for ( let edge of this.edges ) {
      const x = foundry.utils.lineSegmentIntersects(this.origin, initial, edge.vertexA, edge.vertexB);
      if ( x ) edges.add(edge);
    }
    return edges;
  }

  /* -------------------------------------------- */

  /**
   * Sort vertices clockwise from the initial ray (due west).
   * @returns {PolygonVertex[]}             The array of sorted vertices
   * @private
   */
  _sortVertices() {
    if ( !this.vertices.size ) return [];
    let vertices = Array.from(this.vertices.values());
    const o = this.origin;

    // Sort vertices
    vertices.sort((a, b) => {

      // Use true intersection coordinates if they are defined
      let pA = a._intersectionCoordinates || a;
      let pB = b._intersectionCoordinates || b;

      // Sort by hemisphere
      const ya = pA.y > o.y ? 1 : -1;
      const yb = pB.y > o.y ? 1 : -1;
      if ( ya !== yb ) return ya;       // Sort N, S

      // Sort by quadrant
      const qa = pA.x < o.x ? -1 : 1;
      const qb = pB.x < o.x ? -1 : 1;
      if ( qa !== qb ) {                // Sort NW, NE, SE, SW
        if ( ya === -1 ) return qa;
        else return -qa;
      }

      // Sort clockwise within quadrant
      const orientation = foundry.utils.orient2dFast(o, pA, pB);
      if ( orientation !== 0 ) return orientation;

      // At this point, we know points are collinear; track for later processing.
      a.collinearVertices.add(b);
      b.collinearVertices.add(a);

      // Otherwise, sort closer points first
      a._d2 ||= Math.pow(pA.x - o.x, 2) + Math.pow(pA.y - o.y, 2);
      b._d2 ||= Math.pow(pB.x - o.x, 2) + Math.pow(pB.y - o.y, 2);
      return a._d2 - b._d2;
    });
    return vertices;
  }

  /* -------------------------------------------- */

  /**
   * Test whether a target vertex is behind some closer active edge.
   * If the vertex is to the left of the edge, is must be behind the edge relative to origin.
   * If the vertex is collinear with the edge, it should be considered "behind" and ignored.
   * We know edge.vertexA is ccw to edge.vertexB because of the logic in _identifyVertices.
   * @param {PolygonVertex} vertex      The target vertex
   * @param {EdgeSet} activeEdges       The set of active edges
   * @returns {{isBehind: boolean, wasLimited: boolean}} Is the target vertex behind some closer edge?
   * @private
   */
  _isVertexBehindActiveEdges(vertex, activeEdges) {
    let wasLimited = false;
    for ( let edge of activeEdges ) {
      if ( vertex.edges.has(edge) ) continue;
      if ( foundry.utils.orient2dFast(edge.vertexA, edge.vertexB, vertex) > 0 ) {
        if ( ( edge.isLimited(this.config.type) ) && !wasLimited ) wasLimited = true;
        else return {isBehind: true, wasLimited};
      }
    }
    return {isBehind: false, wasLimited};
  }

  /* -------------------------------------------- */

  /**
   * Determine the result for the sweep at a given vertex
   * @param {PolygonVertex} vertex      The target vertex
   * @param {EdgeSet} activeEdges       The set of active edges
   * @param {boolean} hasCollinear      Are there collinear vertices behind the target vertex?
   * @private
   */
  _determineSweepResult(vertex, activeEdges, hasCollinear=false) {

    // Determine whether the target vertex is behind some other active edge
    const {isBehind, wasLimited} = this._isVertexBehindActiveEdges(vertex, activeEdges);

    // Case 1 - Some vertices can be ignored because they are behind other active edges
    if ( isBehind ) return;

    // Construct the CollisionResult object
    const result = new foundry.canvas.edges.CollisionResult({
      target: vertex,
      cwEdges: vertex.cwEdges,
      ccwEdges: vertex.ccwEdges,
      isLimited: vertex.isLimited,
      isBehind,
      wasLimited
    });

    // Case 2 - No counter-clockwise edge, so begin a new edge
    // Note: activeEdges always contain the vertex edge, so never empty
    const nccw = vertex.ccwEdges.size;
    if ( !nccw ) {
      this._switchEdge(result, activeEdges);
      result.collisions.forEach(pt => this.addPoint(pt));
      return;
    }

    // Case 3 - Limited edges in both directions
    // We can only guarantee this case if we don't have collinear endpoints
    const ccwLimited = !result.wasLimited && vertex.isLimitingCCW;
    const cwLimited = !result.wasLimited && vertex.isLimitingCW;
    if ( !hasCollinear && cwLimited && ccwLimited ) return;

    // Case 4 - Non-limited edges in both directions
    if ( !ccwLimited && !cwLimited && nccw && vertex.cwEdges.size ) {
      result.collisions.push(result.target);
      this.addPoint(result.target);
      return;
    }

    // Case 5 - Otherwise switching edges or edge types
    this._switchEdge(result, activeEdges);
    result.collisions.forEach(pt => this.addPoint(pt));
  }

  /* -------------------------------------------- */

  /**
   * Switch to a new active edge.
   * Moving from the origin, a collision that first blocks a side must be stored as a polygon point.
   * Subsequent collisions blocking that side are ignored. Once both sides are blocked, we are done.
   *
   * Collisions that limit a side will block if that side was previously limited.
   *
   * If neither side is blocked and the ray internally collides with a non-limited edge, n skip without adding polygon
   * endpoints. Sight is unaffected before this edge, and the internal collision can be ignored.
   * @private
   *
   * @param {CollisionResult} result    The pending collision result
   * @param {EdgeSet} activeEdges       The set of currently active edges
   */
  _switchEdge(result, activeEdges) {
    const origin = this.origin;

    // Construct the ray from the origin
    const ray = Ray.towardsPointSquared(origin, result.target, this.#rayDistance2);
    ray.result = result;
    this.rays.push(ray); // For visualization and debugging

    // Create a sorted array of collisions containing the target vertex, other collinear vertices, and collision points
    const vertices = [result.target, ...result.target.collinearVertices];
    const keys = new Set();
    for ( const v of vertices ) {
      keys.add(v.key);
      v._d2 ??= Math.pow(v.x - origin.x, 2) + Math.pow(v.y - origin.y, 2);
    }
    this.#addInternalEdgeCollisions(vertices, keys, ray, activeEdges);
    vertices.sort((a, b) => a._d2 - b._d2);

    // As we iterate over intersection points we will define the insertion method
    let insert = undefined;
    const c = result.collisions;
    for ( const x of vertices ) {

      if ( x.isInternal ) {  // Handle internal collisions
        // If neither side yet blocked and this is a non-limited edge, return
        if ( !result.blockedCW && !result.blockedCCW && !x.isLimited ) return;

        // Assume any edge is either limited or normal, so if not limited, must block. If already limited, must block
        result.blockedCW ||= !x.isLimited || result.limitedCW;
        result.blockedCCW ||= !x.isLimited || result.limitedCCW;
        result.limitedCW = true;
        result.limitedCCW = true;

      } else { // Handle true endpoints
        result.blockedCW ||= (result.limitedCW && x.isLimitingCW) || x.isBlockingCW;
        result.blockedCCW ||= (result.limitedCCW && x.isLimitingCCW) || x.isBlockingCCW;
        result.limitedCW ||= x.isLimitingCW;
        result.limitedCCW ||= x.isLimitingCCW;
      }

      // Define the insertion method and record a collision point
      if ( result.blockedCW ) {
        insert ||= c.unshift;
        if ( !result.blockedCWPrev ) insert.call(c, x);
      }
      if ( result.blockedCCW ) {
        insert ||= c.push;
        if ( !result.blockedCCWPrev ) insert.call(c, x);
      }

      // Update blocking flags
      if ( result.blockedCW && result.blockedCCW ) return;
      result.blockedCWPrev ||= result.blockedCW;
      result.blockedCCWPrev ||= result.blockedCCW;
    }
  }

  /* -------------------------------------------- */

  /**
   * Identify the collision points between an emitted Ray and a set of active edges.
   * @param {PolygonVertex[]} vertices      Active vertices
   * @param {Set<number>} keys              Active vertex keys
   * @param {PolygonRay} ray                The candidate ray to test
   * @param {EdgeSet} activeEdges           The set of edges to check for collisions against the ray
   */
  #addInternalEdgeCollisions(vertices, keys, ray, activeEdges) {
    for ( const edge of activeEdges ) {
      if ( keys.has(edge.vertexA.key) || keys.has(edge.vertexB.key) ) continue;
      const x = foundry.utils.lineLineIntersection(ray.A, ray.B, edge.vertexA, edge.vertexB);
      if ( !x ) continue;
      const c = foundry.canvas.edges.PolygonVertex.fromPoint(x);
      c.attachEdge(edge, 0, this.config.type);
      c.isInternal = true;
      c._d2 = Math.pow(x.x - ray.A.x, 2) + Math.pow(x.y - ray.A.y, 2);
      vertices.push(c);
    }
  }

  /* -------------------------------------------- */
  /*  Collision Testing                           */
  /* -------------------------------------------- */

  /** @override */
  _testCollision(ray, mode) {
    const {debug, type} = this.config;

    // Identify candidate edges
    this._identifyEdges();

    // Identify collision points
    let collisions = new Map();
    for ( const edge of this.edges ) {
      const x = foundry.utils.lineSegmentIntersection(this.origin, ray.B, edge.a, edge.b);
      if ( !x || (x.t0 <= 0) ) continue;
      if ( (mode === "any") && (!edge.isLimited(type) || collisions.size) ) return true;
      let c = foundry.canvas.edges.PolygonVertex.fromPoint(x, {distance: x.t0});
      if ( collisions.has(c.key) ) c = collisions.get(c.key);
      else collisions.set(c.key, c);
      c.attachEdge(edge, 0, type);
    }
    if ( mode === "any" ) return false;

    // Sort collisions
    collisions = Array.from(collisions.values()).sort((a, b) => a._distance - b._distance);
    if ( collisions[0]?.isLimited ) collisions.shift();

    // Visualize result
    if ( debug ) this._visualizeCollision(ray, collisions);

    // Return collision result
    if ( mode === "all" ) return collisions;
    else return collisions[0] || null;
  }

  /* -------------------------------------------- */
  /*  Visualization                               */
  /* -------------------------------------------- */

  /** @override */
  visualize() {
    let dg = canvas.controls.debug;
    dg.clear();

    // Text debugging
    if ( !canvas.controls.debug.debugText ) {
      canvas.controls.debug.debugText = canvas.controls.addChild(new PIXI.Container());
    }
    const text = canvas.controls.debug.debugText;
    text.removeChildren().forEach(c => c.destroy({children: true}));

    // Define limitation colors
    const limitColors = {
      [CONST.WALL_SENSE_TYPES.NONE]: 0x77E7E8,
      [CONST.WALL_SENSE_TYPES.NORMAL]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.LIMITED]: 0x81B90C,
      [CONST.WALL_SENSE_TYPES.PROXIMITY]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.DISTANCE]: 0xFFFFBB
    };

    // Draw boundary shapes
    for ( const constraint of this.config.boundaryShapes ) {
      dg.lineStyle(2, 0xFF4444, 1.0).beginFill(0xFF4444, 0.10).drawShape(constraint).endFill();
    }

    // Draw the final polygon shape
    dg.beginFill(0x00AAFF, 0.25).drawShape(this).endFill();

    // Draw candidate edges
    for ( let edge of this.edges ) {
      const c = limitColors[edge[this.config.type]];
      dg.lineStyle(4, c).moveTo(edge.a.x, edge.a.y).lineTo(edge.b.x, edge.b.y);
    }

    // Draw vertices
    for ( let vertex of this.vertices.values() ) {
      const r = vertex.restriction;
      if ( r ) dg.lineStyle(1, 0x000000).beginFill(limitColors[r]).drawCircle(vertex.x, vertex.y, 8).endFill();
      if ( vertex._index ) {
        let t = text.addChild(new PIXI.Text(String(vertex._index), CONFIG.canvasTextStyle));
        t.position.set(vertex.x, vertex.y);
      }
    }

    // Draw emitted rays
    for ( let ray of this.rays ) {
      const r = ray.result;
      if ( r ) {
        dg.lineStyle(2, 0x00FF00, r.collisions.length ? 1.0 : 0.33).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);
        for ( let c of r.collisions ) {
          dg.lineStyle(1, 0x000000).beginFill(0xFF0000).drawCircle(c.x, c.y, 6).endFill();
        }
      }
    }
    return dg;
  }

  /* -------------------------------------------- */

  /**
   * Visualize the polygon, displaying its computed area, rays, and collision points
   * @param {Ray} ray
   * @param {PolygonVertex[]} collisions
   * @private
   */
  _visualizeCollision(ray, collisions) {
    let dg = canvas.controls.debug;
    dg.clear();
    const limitColors = {
      [CONST.WALL_SENSE_TYPES.NONE]: 0x77E7E8,
      [CONST.WALL_SENSE_TYPES.NORMAL]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.LIMITED]: 0x81B90C,
      [CONST.WALL_SENSE_TYPES.PROXIMITY]: 0xFFFFBB,
      [CONST.WALL_SENSE_TYPES.DISTANCE]: 0xFFFFBB
    };

    // Draw edges
    for ( let edge of this.edges.values() ) {
      const c = limitColors[edge[this.config.type]];
      dg.lineStyle(4, c).moveTo(edge.a.x, edge.b.y).lineTo(edge.b.x, edge.b.y);
    }

    // Draw the attempted ray
    dg.lineStyle(4, 0x0066CC).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);

    // Draw collision points
    for ( let x of collisions ) {
      dg.lineStyle(1, 0x000000).beginFill(0xFF0000).drawCircle(x.x, x.y, 6).endFill();
    }
  }
}
