/**
 * A Detection Mode which can be associated with any kind of sense/vision/perception.
 * A token could have multiple detection modes.
 */
class DetectionMode extends foundry.abstract.DataModel {

  /** @inheritDoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      id: new fields.StringField({blank: false}),
      label: new fields.StringField({blank: false}),
      tokenConfig: new fields.BooleanField({initial: true}),       // If this DM is available in Token Config UI
      walls: new fields.BooleanField({initial: true}),             // If this DM is constrained by walls
      angle: new fields.BooleanField({initial: true}),             // If this DM is constrained by the vision angle
      type: new fields.NumberField({
        initial: this.DETECTION_TYPES.SIGHT,
        choices: Object.values(this.DETECTION_TYPES)
      })
    };
  }

  /* -------------------------------------------- */

  /**
   * Get the detection filter pertaining to this mode.
   * @returns {PIXI.Filter|undefined}
   */
  static getDetectionFilter() {
    return this._detectionFilter;
  }

  /**
   * An optional filter to apply on the target when it is detected with this mode.
   * @type {PIXI.Filter|undefined}
   */
  static _detectionFilter;

  static {
    /**
     * The type of the detection mode.
     * @enum {number}
     */
    Object.defineProperty(this, "DETECTION_TYPES", {value: Object.freeze({
      SIGHT: 0,       // Sight, and anything depending on light perception
      SOUND: 1,       // What you can hear. Includes echolocation for bats per example
      MOVE: 2,        // This is mostly a sense for touch and vibration, like tremorsense, movement detection, etc.
      OTHER: 3        // Can't fit in other types (smell, life sense, trans-dimensional sense, sense of humor...)
    })});

    /**
     * The identifier of the basic sight detection mode.
     * @type {string}
     */
    Object.defineProperty(this, "BASIC_MODE_ID", {value: "basicSight"});
  }

  /* -------------------------------------------- */
  /*  Visibility Testing                          */
  /* -------------------------------------------- */

  /**
   * Test visibility of a target object or array of points for a specific vision source.
   * @param {VisionSource} visionSource           The vision source being tested
   * @param {TokenDetectionMode} mode             The detection mode configuration
   * @param {CanvasVisibilityTestConfig} config   The visibility test configuration
   * @returns {boolean}                           Is the test target visible?
   */
  testVisibility(visionSource, mode, {object, tests}={}) {
    if ( !mode.enabled ) return false;
    if ( !this._canDetect(visionSource, object) ) return false;
    return tests.some(test => this._testPoint(visionSource, mode, object, test));
  }

  /* -------------------------------------------- */

  /**
   * Can this VisionSource theoretically detect a certain object based on its properties?
   * This check should not consider the relative positions of either object, only their state.
   * @param {VisionSource} visionSource   The vision source being tested
   * @param {PlaceableObject} target      The target object being tested
   * @returns {boolean}                   Can the target object theoretically be detected by this vision source?
   * @protected
   */
  _canDetect(visionSource, target) {
    const src = visionSource.object.document;
    const isSight = this.type === DetectionMode.DETECTION_TYPES.SIGHT;

    // Sight-based detection fails when blinded
    if ( isSight && src.hasStatusEffect(CONFIG.specialStatusEffects.BLIND) ) return false;

    // Detection fails if burrowing unless walls are ignored
    if ( this.walls && src.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    if ( target instanceof Token ) {
      const tgt = target.document;

      // Sight-based detection cannot see invisible tokens
      if ( isSight && tgt.hasStatusEffect(CONFIG.specialStatusEffects.INVISIBLE) ) return false;

      // Burrowing tokens cannot be detected unless walls are ignored
      if ( this.walls && tgt.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    }
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Evaluate a single test point to confirm whether it is visible.
   * Standard detection rules require that the test point be both within LOS and within range.
   * @param {VisionSource} visionSource           The vision source being tested
   * @param {TokenDetectionMode} mode             The detection mode configuration
   * @param {PlaceableObject} target              The target object being tested
   * @param {CanvasVisibilityTest} test           The test case being evaluated
   * @returns {boolean}
   * @protected
   */
  _testPoint(visionSource, mode, target, test) {
    if ( !this._testRange(visionSource, mode, target, test) ) return false;
    return this._testLOS(visionSource, mode, target, test);
  }

  /* -------------------------------------------- */

  /**
   * Test whether the line-of-sight requirement for detection is satisfied.
   * Always true if the detection mode bypasses walls, otherwise the test point must be contained by the LOS polygon.
   * The result of is cached for the vision source so that later checks for other detection modes do not repeat it.
   * @param {VisionSource} visionSource       The vision source being tested
   * @param {TokenDetectionMode} mode         The detection mode configuration
   * @param {PlaceableObject} target          The target object being tested
   * @param {CanvasVisibilityTest} test       The test case being evaluated
   * @returns {boolean}                       Is the LOS requirement satisfied for this test?
   * @protected
   */
  _testLOS(visionSource, mode, target, test) {
    if ( !this.walls ) return this._testAngle(visionSource, mode, target, test);
    const type = visionSource.constructor.sourceType;
    const isSight = type === "sight";
    if ( isSight && visionSource.blinded.darkness ) return false;
    if ( !this.angle && (visionSource.data.angle < 360) ) {
      // Constrained by walls but not by vision angle
      return !CONFIG.Canvas.polygonBackends[type].testCollision(
        { x: visionSource.x, y: visionSource.y },
        test.point,
        { type, mode: "any", source: visionSource, useThreshold: true, includeDarkness: isSight }
      );
    }
    // Constrained by walls and vision angle
    let hasLOS = test.los.get(visionSource);
    if ( hasLOS === undefined ) {
      hasLOS = visionSource.los.contains(test.point.x, test.point.y);
      test.los.set(visionSource, hasLOS);
    }
    return hasLOS;
  }

  /* -------------------------------------------- */

  /**
   * Test whether the target is within the vision angle.
   * @param {VisionSource} visionSource       The vision source being tested
   * @param {TokenDetectionMode} mode         The detection mode configuration
   * @param {PlaceableObject} target          The target object being tested
   * @param {CanvasVisibilityTest} test       The test case being evaluated
   * @returns {boolean}                       Is the point within the vision angle?
   * @protected
   */
  _testAngle(visionSource, mode, target, test) {
    if ( !this.angle ) return true;
    const { angle, rotation, externalRadius } = visionSource.data;
    if ( angle >= 360 ) return true;
    const point = test.point;
    const dx = point.x - visionSource.x;
    const dy = point.y - visionSource.y;
    if ( (dx * dx) + (dy * dy) <= (externalRadius * externalRadius) ) return true;
    const aMin = rotation + 90 - (angle / 2);
    const a = Math.toDegrees(Math.atan2(dy, dx));
    return (((a - aMin) % 360) + 360) % 360 <= angle;
  }

  /* -------------------------------------------- */

  /**
   * Verify that a target is in range of a source.
   * @param {VisionSource} visionSource           The vision source being tested
   * @param {TokenDetectionMode} mode             The detection mode configuration
   * @param {PlaceableObject} target              The target object being tested
   * @param {CanvasVisibilityTest} test           The test case being evaluated
   * @returns {boolean}                           Is the target within range?
   * @protected
   */
  _testRange(visionSource, mode, target, test) {
    if ( mode.range === null ) return true;
    if ( mode.range <= 0 ) return false;
    const radius = visionSource.object.getLightRadius(mode.range);
    const dx = test.point.x - visionSource.x;
    const dy = test.point.y - visionSource.y;
    return ((dx * dx) + (dy * dy)) <= (radius * radius);
  }
}

/* -------------------------------------------- */

/**
 * This detection mode tests whether the target is visible due to being illuminated by a light source.
 * By default tokens have light perception with an infinite range if light perception isn't explicitely
 * configured.
 */
class DetectionModeLightPerception extends DetectionMode {

  /** @override */
  _canDetect(visionSource, target) {

    // Cannot see while blinded or burrowing
    const src = visionSource.object.document;
    if ( src.hasStatusEffect(CONFIG.specialStatusEffects.BLIND)
      || src.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;

    // Cannot see invisible or burrowing creatures
    if ( target instanceof Token ) {
      const tgt = target.document;
      if ( tgt.hasStatusEffect(CONFIG.specialStatusEffects.INVISIBLE)
        || tgt.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    }
    return true;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _testPoint(visionSource, mode, target, test) {
    if ( !super._testPoint(visionSource, mode, target, test) ) return false;
    return canvas.effects.testInsideLight(test.point, test.elevation);
  }
}

/* -------------------------------------------- */

/**
 * A special detection mode which models a form of darkvision (night vision).
 * This mode is the default case which is tested first when evaluating visibility of objects.
 */
class DetectionModeBasicSight extends DetectionMode {

  /** @override */
  _canDetect(visionSource, target) {

    // Cannot see while blinded or burrowing
    const src = visionSource.object.document;
    if ( src.hasStatusEffect(CONFIG.specialStatusEffects.BLIND)
      || src.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;

    // Cannot see invisible or burrowing creatures
    if ( target instanceof Token ) {
      const tgt = target.document;
      if ( tgt.hasStatusEffect(CONFIG.specialStatusEffects.INVISIBLE)
        || tgt.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    }
    return true;
  }
}

/* -------------------------------------------- */

/**
 * Detection mode that see invisible creatures.
 * This detection mode allows the source to:
 * - See/Detect the invisible target as if visible.
 * - The "See" version needs sight and is affected by blindness
 */
class DetectionModeInvisibility extends DetectionMode {

  /** @override */
  static getDetectionFilter() {
    return this._detectionFilter ??= GlowOverlayFilter.create({
      glowColor: [0, 0.60, 0.33, 1]
    });
  }

  /** @override */
  _canDetect(visionSource, target) {
    if ( !(target instanceof Token) ) return false;
    const tgt = target.document;

    // Only invisible tokens can be detected
    if ( !tgt.hasStatusEffect(CONFIG.specialStatusEffects.INVISIBLE) ) return false;
    const src = visionSource.object.document;
    const isSight = this.type === DetectionMode.DETECTION_TYPES.SIGHT;

    // Sight-based detection fails when blinded
    if ( isSight && src.hasStatusEffect(CONFIG.specialStatusEffects.BLIND) ) return false;

    // Detection fails when the source or target token is burrowing unless walls are ignored
    if ( this.walls ) {
      if ( src.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
      if ( tgt.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    }
    return true;
  }
}

/* -------------------------------------------- */

/**
 * Detection mode that see creatures in contact with the ground.
 */
class DetectionModeTremor extends DetectionMode {
  /** @override */
  static getDetectionFilter() {
    return this._detectionFilter ??= OutlineOverlayFilter.create({
      outlineColor: [1, 0, 1, 1],
      knockout: true,
      wave: true
    });
  }

  /** @override */
  _canDetect(visionSource, target) {
    if ( !(target instanceof Token) ) return false;
    const tgt = target.document;

    // Flying and hovering tokens cannot be detected
    if ( tgt.hasStatusEffect(CONFIG.specialStatusEffects.FLY) ) return false;
    if ( tgt.hasStatusEffect(CONFIG.specialStatusEffects.HOVER) ) return false;
    return true;
  }
}

/* -------------------------------------------- */

/**
 * Detection mode that see ALL creatures (no blockers).
 * If not constrained by walls, see everything within the range.
 */
class DetectionModeAll extends DetectionMode {
  /** @override */
  static getDetectionFilter() {
    return this._detectionFilter ??= OutlineOverlayFilter.create({
      outlineColor: [0.85, 0.85, 1.0, 1],
      knockout: true
    });
  }

  /** @override */
  _canDetect(visionSource, target) {
    const src = visionSource.object.document;
    const isSight = this.type === DetectionMode.DETECTION_TYPES.SIGHT;

    // Sight-based detection fails when blinded
    if ( isSight && src.hasStatusEffect(CONFIG.specialStatusEffects.BLIND) ) return false;

    // Detection fails when the source or target token is burrowing unless walls are ignored
    if ( !this.walls ) return true;
    if ( src.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    if ( target instanceof Token ) {
      const tgt = target.document;
      if ( tgt.hasStatusEffect(CONFIG.specialStatusEffects.BURROW) ) return false;
    }
    return true;
  }
}
