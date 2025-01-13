/**
 * An implementation of the PlaceableHUD base class which renders a heads-up-display interface for Tile objects.
 * The TileHUD implementation can be configured and replaced via {@link CONFIG.Tile.hudClass}.
 * @extends {BasePlaceableHUD<Tile, TileDocument, TilesLayer>}
 */
class TileHUD extends BasePlaceableHUD {

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "tile-hud",
      template: "templates/hud/tile-hud.html"
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getData(options={}) {
    const {locked, hidden} = this.document;
    const {isVideo, sourceElement} = this.object;
    const isPlaying = isVideo && !sourceElement.paused && !sourceElement.ended;
    return foundry.utils.mergeObject(super.getData(options), {
      isVideo: isVideo,
      lockedClass: locked ? "active" : "",
      visibilityClass: hidden ? "active" : "",
      videoIcon: isPlaying ? "fas fa-pause" : "fas fa-play",
      videoTitle: game.i18n.localize(isPlaying ? "HUD.TilePause" : "HUD.TilePlay")
    });
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options) {
    let {x, y, width, height} = this.object.frame.bounds;
    const c = 70;
    const p = 10;
    const position = {
      width: width + (c * 2) + (p * 2),
      height: height + (p * 2),
      left: x + this.object.x - c - p,
      top: y + this.object.y - p
    };
    this.element.css(position);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClickControl(event) {
    super._onClickControl(event);
    if ( event.defaultPrevented ) return;
    const button = event.currentTarget;
    switch ( button.dataset.action ) {
      case "video":
        return this.#onControlVideo(event);
    }
  }

  /* -------------------------------------------- */

  /**
   * Control video playback by toggling play or paused state for a video Tile.
   * @param {PointerEvent} event
   */
  #onControlVideo(event) {
    const src = this.object.sourceElement;
    const icon = event.currentTarget.children[0];
    const isPlaying = !src.paused && !src.ended;

    // Intercepting state change if the source is not looping and not playing
    if ( !src.loop && !isPlaying ) {
      const self = this;
      src.onpause = () => {
        if ( self.object?.sourceElement ) {
          icon.classList.replace("fa-pause", "fa-play");
          self.render();
        }
        src.onpause = null;
      };
    }

    // Update the video playing state
    return this.object.document.update({"video.autoplay": false}, {
      diff: false,
      playVideo: !isPlaying,
      offset: src.ended ? 0 : null
    });
  }
}
