/**
 * The singleton collection of Actor documents which exist within the active World.
 * This Collection is accessible within the Game object as game.actors.
 * @extends {WorldCollection}
 * @category - Collections
 *
 * @see {@link Actor} The Actor document
 * @see {@link ActorDirectory} The ActorDirectory sidebar directory
 *
 * @example Retrieve an existing Actor by its id
 * ```js
 * let actor = game.actors.get(actorId);
 * ```
 */
class Actors extends WorldCollection {
  /**
   * A mapping of synthetic Token Actors which are currently active within the viewed Scene.
   * Each Actor is referenced by the Token.id.
   * @type {Record<string, Actor>}
   */
  get tokens() {
    if ( !canvas.ready || !canvas.scene ) return {};
    return canvas.scene.tokens.reduce((obj, t) => {
      if ( t.actorLink ) return obj;
      obj[t.id] = t.actor;
      return obj;
    }, {});
  }

  /* -------------------------------------------- */

  /** @override */
  static documentName = "Actor";

  /* -------------------------------------------- */

  /**
   * @param {Document|object} document
   * @param {FromCompendiumOptions} [options]
   * @param {boolean} [options.clearPrototypeToken=true]  Clear prototype token data to allow default token settings to
   *                                                      be applied.
   * @returns {object}
   */
  fromCompendium(document, options={}) {
    const data = super.fromCompendium(document, options);

    // Clear prototype token data.
    if ( (options.clearPrototypeToken !== false) && ("prototypeToken" in data) ) {
      const settings = game.settings.get("core", DefaultTokenConfig.SETTING) ?? {};
      foundry.data.PrototypeToken.schema.apply(function(v) {
        if ( typeof v !== "object" ) foundry.utils.setProperty(data.prototypeToken, this.fieldPath, undefined);
      }, settings, { partial: true });
    }

    // Re-associate imported Active Effects which are sourced to Items owned by this same Actor
    if ( data._id ) {
      const ownItemIds = new Set(data.items.map(i => i._id));
      for ( let effect of data.effects ) {
        if ( !effect.origin ) continue;
        const effectItemId = effect.origin.split(".").pop();
        if ( ownItemIds.has(effectItemId) ) {
          effect.origin = `Actor.${data._id}.Item.${effectItemId}`;
        }
      }
    }
    return data;
  }
}
