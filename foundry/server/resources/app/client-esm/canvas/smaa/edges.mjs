/**
 * The edge detection filter for {@link foundry.canvas.SMAAFilter}.
 */
export default class SMAAEdgeDetectionFilter extends PIXI.Filter {
  /**
   * @param {SMAAFilterConfig} config
   */
  constructor(config) {
    super(VERTEX_SOURCE, generateFragmentSource(config));
  }
}

/* -------------------------------------------- */

/**
 * The vertex shader source of {@link SMAAEdgeDetectionFilter}.
 * @type {string}
 */
const VERTEX_SOURCE = `\
#define mad(a, b, c) (a * b + c)

attribute vec2 aVertexPosition;

uniform mat3 projectionMatrix;
uniform vec4 inputSize;
uniform vec4 inputPixel;
uniform vec4 outputFrame;

#define resolution (inputPixel.xy)
#define SMAA_RT_METRICS (inputPixel.zwxy)

varying vec2 vTexCoord0;
varying vec4 vOffset[3];

void main() {
    vTexCoord0 = aVertexPosition * (outputFrame.zw * inputSize.zw);

    vOffset[0] = mad(SMAA_RT_METRICS.xyxy, vec4(-1.0, 0.0, 0.0, -1.0), vTexCoord0.xyxy);
    vOffset[1] = mad(SMAA_RT_METRICS.xyxy, vec4( 1.0, 0.0, 0.0,  1.0), vTexCoord0.xyxy);
    vOffset[2] = mad(SMAA_RT_METRICS.xyxy, vec4(-2.0, 0.0, 0.0, -2.0), vTexCoord0.xyxy);

    vec3 position = vec3(aVertexPosition * max(outputFrame.zw, vec2(0.0)) + outputFrame.xy, 1.0);
    gl_Position = vec4((projectionMatrix * position).xy, 0.0, 1.0);
}
`;

/* -------------------------------------------- */

/**
 * The fragment shader source of {@link SMAAEdgeDetectionFilter}.
 * @param {SMAAFilterConfig} config
 * @returns {string}
 */
function generateFragmentSource(config) {
  return `\
precision highp float;

/**
 * Color Edge Detection
 *
 * IMPORTANT NOTICE: color edge detection requires gamma-corrected colors, and
 * thus 'colorTex' should be a non-sRGB texture.
 */

#define SMAA_THRESHOLD ${config.threshold.toFixed(8)}
#define SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR ${config.localContrastAdaptionFactor.toFixed(8)}

uniform sampler2D uSampler; // colorTex

#define colorTex uSampler

varying vec2 vTexCoord0;
varying vec4 vOffset[3];

void main() {
    // Calculate the threshold:
    vec2 threshold = vec2(SMAA_THRESHOLD);

    // Calculate color deltas:
    vec4 delta;
    vec3 c = texture2D(colorTex, vTexCoord0).rgb;

    vec3 cLeft = texture2D(colorTex, vOffset[0].xy).rgb;
    vec3 t = abs(c - cLeft);
    delta.x = max(max(t.r, t.g), t.b);

    vec3 cTop  = texture2D(colorTex, vOffset[0].zw).rgb;
    t = abs(c - cTop);
    delta.y = max(max(t.r, t.g), t.b);

    // We do the usual threshold:
    vec2 edges = step(threshold, delta.xy);

    // Then discard if there is no edge:
    if (dot(edges, vec2(1.0, 1.0)) == 0.0)
        discard;

    // Calculate right and bottom deltas:
    vec3 cRight = texture2D(colorTex, vOffset[1].xy).rgb;
    t = abs(c - cRight);
    delta.z = max(max(t.r, t.g), t.b);

    vec3 cBottom  = texture2D(colorTex, vOffset[1].zw).rgb;
    t = abs(c - cBottom);
    delta.w = max(max(t.r, t.g), t.b);

    // Calculate the maximum delta in the direct neighborhood:
    vec2 maxDelta = max(delta.xy, delta.zw);

    // Calculate left-left and top-top deltas:
    vec3 cLeftLeft  = texture2D(colorTex, vOffset[2].xy).rgb;
    t = abs(c - cLeftLeft);
    delta.z = max(max(t.r, t.g), t.b);

    vec3 cTopTop = texture2D(colorTex, vOffset[2].zw).rgb;
    t = abs(c - cTopTop);
    delta.w = max(max(t.r, t.g), t.b);

    // Calculate the final maximum delta:
    maxDelta = max(maxDelta.xy, delta.zw);
    float finalDelta = max(maxDelta.x, maxDelta.y);

    // Local contrast adaptation:
    edges.xy *= step(finalDelta, SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR * delta.xy);

    gl_FragColor = vec4(edges, 0.0, 1.0);
}
`;
}
