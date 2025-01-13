/**
 * An abstract subclass of the Collection container which defines a collection of Document instances.
 * @extends {Collection}
 * @abstract
 *
 * @param {object[]} data      An array of data objects from which to create document instances
 */
class DocumentCollection extends foundry.utils.Collection {
  constructor(data=[]) {
    super();

    /**
     * The source data array from which the Documents in the WorldCollection are created
     * @type {object[]}
     * @private
     */
    Object.defineProperty(this, "_source", {
      value: data,
      writable: false
    });

    /**
     * An Array of application references which will be automatically updated when the collection content changes
     * @type {Application[]}
     */
    this.apps = [];

    // Initialize data
    this._initialize();
  }

  /* -------------------------------------------- */

  /**
   * Initialize the DocumentCollection by constructing any initially provided Document instances
   * @private
   */
  _initialize() {
    this.clear();
    for ( let d of this._source ) {
      let doc;
      if ( game.issues ) game.issues._countDocumentSubType(this.documentClass, d);
      try {
        doc = this.documentClass.fromSource(d, {strict: true, dropInvalidEmbedded: true});
        super.set(doc.id, doc);
      } catch(err) {
        this.invalidDocumentIds.add(d._id);
        if ( game.issues ) game.issues._trackValidationFailure(this, d, err);
        Hooks.onError(`${this.constructor.name}#_initialize`, err, {
          msg: `Failed to initialize ${this.documentName} [${d._id}]`,
          log: "error",
          id: d._id
        });
      }
    }
  }

  /* -------------------------------------------- */
  /*  Collection Properties                       */
  /* -------------------------------------------- */

  /**
   * A reference to the Document class definition which is contained within this DocumentCollection.
   * @type {typeof foundry.abstract.Document}
   */
  get documentClass() {
    return getDocumentClass(this.documentName);
  }

  /** @inheritdoc */
  get documentName() {
    const name = this.constructor.documentName;
    if ( !name ) throw new Error("A subclass of DocumentCollection must define its static documentName");
    return name;
  }

  /**
   * The base Document type which is contained within this DocumentCollection
   * @type {string}
   */
  static documentName;

  /**
   * Record the set of document ids where the Document was not initialized because of invalid source data
   * @type {Set<string>}
   */
  invalidDocumentIds = new Set();

  /**
   * The Collection class name
   * @type {string}
   */
  get name() {
    return this.constructor.name;
  }

  /* -------------------------------------------- */
  /*  Collection Methods                          */
  /* -------------------------------------------- */

  /**
   * Instantiate a Document for inclusion in the Collection.
   * @param {object} data       The Document data.
   * @param {object} [context]  Document creation context.
   * @returns {foundry.abstract.Document}
   */
  createDocument(data, context={}) {
    return new this.documentClass(data, context);
  }

  /* -------------------------------------------- */

  /**
   * Obtain a temporary Document instance for a document id which currently has invalid source data.
   * @param {string} id                      A document ID with invalid source data.
   * @param {object} [options]               Additional options to configure retrieval.
   * @param {boolean} [options.strict=true]  Throw an Error if the requested ID is not in the set of invalid IDs for
   *                                         this collection.
   * @returns {Document}                     An in-memory instance for the invalid Document
   * @throws If strict is true and the requested ID is not in the set of invalid IDs for this collection.
   */
  getInvalid(id, {strict=true}={}) {
    if ( !this.invalidDocumentIds.has(id) ) {
      if ( strict ) throw new Error(`${this.constructor.documentName} id [${id}] is not in the set of invalid ids`);
      return;
    }
    const data = this._source.find(d => d._id === id);
    return this.documentClass.fromSource(foundry.utils.deepClone(data));
  }

  /* -------------------------------------------- */

  /**
   * Get an element from the DocumentCollection by its ID.
   * @param {string} id                        The ID of the Document to retrieve.
   * @param {object} [options]                 Additional options to configure retrieval.
   * @param {boolean} [options.strict=false]   Throw an Error if the requested Document does not exist.
   * @param {boolean} [options.invalid=false]  Allow retrieving an invalid Document.
   * @returns {foundry.abstract.Document}
   * @throws If strict is true and the Document cannot be found.
   */
  get(id, {invalid=false, strict=false}={}) {
    let result = super.get(id);
    if ( !result && invalid ) result = this.getInvalid(id, { strict: false });
    if ( !result && strict ) throw new Error(`${this.constructor.documentName} id [${id}] does not exist in the `
      + `${this.constructor.name} collection.`);
    return result;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  set(id, document) {
    const cls = this.documentClass;
    if (!(document instanceof cls)) {
      throw new Error(`You may only push instances of ${cls.documentName} to the ${this.name} collection`);
    }
    const replacement = this.has(document.id);
    super.set(document.id, document);
    if ( replacement ) this._source.findSplice(e => e._id === id, document.toObject());
    else this._source.push(document.toObject());
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  delete(id) {
    super.delete(id);
    const removed = this._source.findSplice(e => e._id === id);
    return !!removed;
  }

  /* -------------------------------------------- */

  /**
   * Render any Applications associated with this DocumentCollection.
   */
  render(force, options) {
    for (let a of this.apps) a.render(force, options);
  }

  /* -------------------------------------------- */

  /**
   * The cache of search fields for each data model
   * @type {Map<string, Set<string>>}
   */
  static #dataModelSearchFieldsCache = new Map();

  /**
   * Get the searchable fields for a given document or index, based on its data model
   * @param {string} documentName         The document type name
   * @param {string} [documentSubtype=""] The document subtype name
   * @param {boolean} [isEmbedded=false]  Whether the document is an embedded object
   * @returns {Set<string>}               The dot-delimited property paths of searchable fields
   */
  static getSearchableFields(documentName, documentSubtype="", isEmbedded=false) {
    const isSubtype = !!documentSubtype;
    const cacheName = isSubtype ? `${documentName}.${documentSubtype}` : documentName;

    // If this already exists in the cache, return it
    if ( DocumentCollection.#dataModelSearchFieldsCache.has(cacheName) ) {
      return DocumentCollection.#dataModelSearchFieldsCache.get(cacheName);
    }

    // Load the Document DataModel
    const docConfig = CONFIG[documentName];
    if ( !docConfig ) throw new Error(`Could not find configuration for ${documentName}`);

    // Read the fields that can be searched from the Data Model
    const textSearchFields = new Set(isSubtype ? this.getSearchableFields(documentName) : []);
    const dataModel = isSubtype ? docConfig.dataModels?.[documentSubtype] : docConfig.documentClass;
    dataModel?.schema.apply(function() {
      if ( (this instanceof foundry.data.fields.StringField) && this.textSearch ) {
        // Non-TypeDataModel sub-types may produce an incorrect field path, in which case we prepend "system."
        textSearchFields.add(isSubtype && !dataModel.schema.name ? `system.${this.fieldPath}` : this.fieldPath);
      }
    });

    // Cache the result
    DocumentCollection.#dataModelSearchFieldsCache.set(cacheName, textSearchFields);

    return textSearchFields;
  }

  /* -------------------------------------------- */

  /**
   * Find all Documents which match a given search term using a full-text search against their indexed HTML fields and their name.
   * If filters are provided, results are filtered to only those that match the provided values.
   * @param {object} search                      An object configuring the search
   * @param {string} [search.query]              A case-insensitive search string
   * @param {FieldFilter[]} [search.filters]     An array of filters to apply
   * @param {string[]} [search.exclude]          An array of document IDs to exclude from search results
   * @returns {string[]}
   */
  search({query= "", filters=[], exclude=[]}) {
    query = SearchFilter.cleanQuery(query);
    const regex = new RegExp(RegExp.escape(query), "i");
    const results = [];
    const hasFilters = !foundry.utils.isEmpty(filters);
    let domParser;
    for ( const doc of this.index ?? this.contents ) {
      if ( exclude.includes(doc._id) ) continue;
      let isMatch = !query;

      // Do a full-text search against any searchable fields based on metadata
      if ( query ) {
        const textSearchFields = DocumentCollection.getSearchableFields(
          doc.constructor.documentName ?? this.documentName, doc.type, !!doc.parentCollection);
        for ( const fieldName of textSearchFields ) {
          let value = foundry.utils.getProperty(doc, fieldName);
          // Search the text context of HTML instead of the HTML
          if ( value ) {
            let field;
            if ( fieldName.startsWith("system.") ) {
              if ( doc.system instanceof foundry.abstract.DataModel ) {
                field = doc.system.schema.getField(fieldName.slice(7));
              }
            } else field = doc.schema.getField(fieldName);
            if ( field instanceof foundry.data.fields.HTMLField ) {
              // TODO: Ideally we would search the text content of the enriched HTML: can we make that happen somehow?
              domParser ??= new DOMParser();
              value = domParser.parseFromString(value, "text/html").body.textContent;
            }
          }
          if ( value && regex.test(SearchFilter.cleanQuery(value)) ) {
            isMatch = true;
            break; // No need to evaluate other fields, we already know this is a match
          }
        }
      }

      // Apply filters
      if ( hasFilters ) {
        for ( const filter of filters ) {
          if ( !SearchFilter.evaluateFilter(doc, filter) ) {
            isMatch = false;
            break; // No need to evaluate other filters, we already know this is not a match
          }
        }
      }

      if ( isMatch ) results.push(doc);
    }

    return results;
  }

  /* -------------------------------------------- */
  /*  Database Operations                         */
  /* -------------------------------------------- */

  /**
   * Update all objects in this DocumentCollection with a provided transformation.
   * Conditionally filter to only apply to Entities which match a certain condition.
   * @param {Function|object} transformation    An object of data or function to apply to all matched objects
   * @param {Function|null}  condition          A function which tests whether to target each object
   * @param {object} [options]                  Additional options passed to Document.updateDocuments
   * @returns {Promise<Document[]>}             An array of updated data once the operation is complete
   */
  async updateAll(transformation, condition=null, options={}) {
    const hasTransformer = transformation instanceof Function;
    if ( !hasTransformer && (foundry.utils.getType(transformation) !== "Object") ) {
      throw new Error("You must provide a data object or transformation function");
    }
    const hasCondition = condition instanceof Function;
    const updates = [];
    for ( let doc of this ) {
      if ( hasCondition && !condition(doc) ) continue;
      const update = hasTransformer ? transformation(doc) : foundry.utils.deepClone(transformation);
      update._id = doc.id;
      updates.push(update);
    }
    return this.documentClass.updateDocuments(updates, options);
  }

  /* -------------------------------------------- */

  /**
   * Follow-up actions to take when a database operation modifies Documents in this DocumentCollection.
   * @param {DatabaseAction} action                   The database action performed
   * @param {ClientDocument[]} documents              The array of modified Documents
   * @param {any[]} result                            The result of the database operation
   * @param {DatabaseOperation} operation             Database operation details
   * @param {User} user                               The User who performed the operation
   * @internal
   */
  _onModifyContents(action, documents, result, operation, user) {
    if ( operation.render ) {
      this.render(false, {renderContext: `${action}${this.documentName}`, renderData: result});
    }
  }
}
