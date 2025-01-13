/**
 * The client-side AmbientLight document which extends the common BaseAmbientLight document model.
 * @extends foundry.documents.BaseAmbientLight
 * @mixes ClientDocumentMixin
 *
 * @see {@link Scene}                     The Scene document type which contains AmbientLight documents
 * @see {@link foundry.applications.sheets.AmbientLightConfig} The AmbientLight configuration application
 */
class AmbientLightDocument extends CanvasDocumentMixin(foundry.documents.BaseAmbientLight) {

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    const configs = Object.values(this.apps).filter(app => {
      return app instanceof foundry.applications.sheets.AmbientLightConfig;
    });
    configs.forEach(app => {
      if ( app.preview ) options.animate = false;
      app._previewChanges(changed);
    });
    super._onUpdate(changed, options, userId);
    configs.forEach(app => app._previewChanges());
  }

  /* -------------------------------------------- */
  /*  Model Properties                            */
  /* -------------------------------------------- */

  /**
   * Is this ambient light source global in nature?
   * @type {boolean}
   */
  get isGlobal() {
    return !this.walls;
  }
}
