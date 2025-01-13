import Edge from "./edge.mjs";

/**
 * A special class of Map which defines all the edges used to restrict perception in a Scene.
 * @extends {Map<string, Edge>}
 */
export default class CanvasEdges extends Map {

  /**
   * Edge instances which represent the outer boundaries of the game canvas.
   * @type {Edge[]}
   */
  #outerBounds = [];

  /**
   * Edge instances which represent the inner boundaries of the scene rectangle.
   * @type {Edge[]}
   */
  #innerBounds = [];

  /* -------------------------------------------- */

  /**
   * Initialize all active edges for the Scene. This workflow occurs once only when the Canvas is first initialized.
   * Edges are created from the following sources:
   * 1. Wall documents
   * 2. Canvas boundaries (inner and outer bounds)
   * 3. Darkness sources
   * 4. Programmatically defined in the "initializeEdges" hook
   */
  initialize() {
    this.clear();

    // Wall Documents
    for ( /** @type {Wall} */ const wall of canvas.walls.placeables ) wall.initializeEdge();

    // Canvas Boundaries
    this.#defineBoundaries();

    // Darkness Sources
    for ( const source of canvas.effects.darknessSources ) {
      for ( const edge of source.edges ) this.set(edge.id, edge);
    }

    // Programmatic Edges
    Hooks.callAll("initializeEdges");
  }

  /* -------------------------------------------- */

  /**
   * Incrementally refresh Edges by computing intersections between all registered edges.
   */
  refresh() {
    Edge.identifyEdgeIntersections(canvas.edges.values());
  }

  /* -------------------------------------------- */

  /**
   * Define Edge instances for outer and inner canvas bounds rectangles.
   */
  #defineBoundaries() {
    const d = canvas.dimensions;
    const define = (type, r) => {
      const top = new Edge({x: r.x, y: r.y}, {x: r.right, y: r.y}, {id: `${type}Top`, type});
      const right = new Edge({x: r.right, y: r.y}, {x: r.right, y: r.bottom}, {id: `${type}Right`, type});
      const bottom = new Edge({x: r.right, y: r.bottom}, {x: r.x, y: r.bottom}, {id: `${type}Bottom`, type});
      const left = new Edge({x: r.x, y: r.bottom}, {x: r.x, y: r.y}, {id: `${type}Left`, type});
      return [top, right, bottom, left];
    };

    // Outer canvas bounds
    this.#outerBounds = define("outerBounds", d.rect);
    for ( const b of this.#outerBounds ) this.set(b.id, b);

    // Inner canvas bounds (if there is padding)
    if ( d.rect.x === d.sceneRect.x ) this.#innerBounds = this.#outerBounds;
    else {
      this.#innerBounds = define("innerBounds", d.sceneRect);
      for ( const b of this.#innerBounds ) this.set(b.id, b);
    }
  }
}
