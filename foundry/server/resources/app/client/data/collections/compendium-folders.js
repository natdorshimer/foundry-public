/**
 * A Collection of Folder documents within a Compendium pack.
 */
class CompendiumFolderCollection extends DocumentCollection {
  constructor(pack, data=[]) {
    super(data);
    this.pack = pack;
  }

  /**
   * The CompendiumPack instance which contains this CompendiumFolderCollection
   * @type {CompendiumPack}
   */
  pack;

  /* -------------------------------------------- */

  /** @inheritdoc */
  get documentName() {
    return "Folder";
  }

  /* -------------------------------------------- */

  /** @override */
  render(force, options) {
    this.pack.render(force, options);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async updateAll(transformation, condition=null, options={}) {
    options.pack = this.collection;
    return super.updateAll(transformation, condition, options);
  }
}
