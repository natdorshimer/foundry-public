/**
 * A minimalist filter (just used for blending)
 */
class VoidFilter extends AbstractBaseFilter {
  static fragmentShader = `
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  void main() {
    gl_FragColor = texture2D(uSampler, vTextureCoord);
  }`;
}
