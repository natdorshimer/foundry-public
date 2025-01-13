import Document from "./document.mjs";

/**
 * @typedef {import("./_types.mjs").DatabaseGetOperation} DatabaseGetOperation
 * @typedef {import("./_types.mjs").DatabaseCreateOperation} DatabaseCreateOperation
 * @typedef {import("./_types.mjs").DatabaseUpdateOperation} DatabaseUpdateOperation
 * @typedef {import("./_types.mjs").DatabaseDeleteOperation} DatabaseDeleteOperation
 */

/**
 * An abstract base class extended on both the client and server which defines how Documents are retrieved, created,
 * updated, and deleted.
 * @alias foundry.abstract.DatabaseBackend
 * @abstract
 */
export default class DatabaseBackend {

  /* -------------------------------------------- */
  /*  Get Operations                              */
  /* -------------------------------------------- */

  /**
   * Retrieve Documents based on provided query parameters.
   * It recommended to use CompendiumCollection#getDocuments or CompendiumCollection#getIndex rather
   * than calling this method directly.
   * @param {typeof Document} documentClass           The Document class definition
   * @param {DatabaseGetOperation} operation          Parameters of the get operation
   * @param {BaseUser} [user]                         The requesting User
   * @returns {Promise<Document[]|object[]>}          An array of retrieved Document instances or index objects
   */
  async get(documentClass, operation, user) {
    operation = await this.#configureGet(operation);
    return this._getDocuments(documentClass, operation, user);
  }

  /* -------------------------------------------- */

  /**
   * Validate and configure the parameters of the get operation.
   * @param {DatabaseGetOperation} operation          The requested operation
   */
  async #configureGet(operation) {
    await this.#configureOperation(operation);
    operation.broadcast = false; // Get requests are never broadcast
    return operation;
  }

  /* -------------------------------------------- */

  /**
   * Retrieve Document instances using the specified operation parameters.
   * @param {typeof Document} documentClass           The Document class definition
   * @param {DatabaseGetOperation} operation          Parameters of the get operation
   * @param {BaseUser} [user]                         The requesting User
   * @returns {Promise<Document[]|object[]>}          An array of retrieved Document instances or index objects
   * @abstract
   * @internal
   * @ignore
   */
  async _getDocuments(documentClass, operation, user) {}

  /* -------------------------------------------- */
  /*  Create Operations                           */
  /* -------------------------------------------- */

  /**
   * Create new Documents using provided data and context.
   * It is recommended to use {@link Document.createDocuments} or {@link Document.create} rather than calling this
   * method directly.
   * @param {typeof Document} documentClass           The Document class definition
   * @param {DatabaseCreateOperation} operation       Parameters of the create operation
   * @param {BaseUser} [user]                         The requesting User
   * @returns {Promise<Document[]>}                   An array of created Document instances
   */
  async create(documentClass, operation, user) {
    operation = await this.#configureCreate(operation);
    return this._createDocuments(documentClass, operation, user);
  }

  /* -------------------------------------------- */

  /**
   * Validate and configure the parameters of the create operation.
   * @param {DatabaseCreateOperation} operation       The requested operation
   */
  async #configureCreate(operation) {
    if ( !Array.isArray(operation.data) ) {
      throw new Error("The data provided to the DatabaseBackend#create operation must be an array of data objects");
    }
    await this.#configureOperation(operation);
    operation.render ??= true;
    operation.renderSheet ??= false;
    return operation;
  }

  /* -------------------------------------------- */

  /**
   * Create Document instances using provided data and operation parameters.
   * @param {typeof Document} documentClass           The Document class definition
   * @param {DatabaseCreateOperation} operation       Parameters of the create operation
   * @param {BaseUser} [user]                         The requesting User
   * @returns {Promise<Document[]>}                   An array of created Document instances
   * @abstract
   * @internal
   * @ignore
   */
  async _createDocuments(documentClass, operation, user) {}

  /* -------------------------------------------- */
  /*  Update Operations                           */
  /* -------------------------------------------- */

  /**
   * Update Documents using provided data and context.
   * It is recommended to use {@link Document.updateDocuments} or {@link Document#update} rather than calling this
   * method directly.
   * @param {typeof Document} documentClass           The Document class definition
   * @param {DatabaseUpdateOperation} operation       Parameters of the update operation
   * @param {BaseUser} [user]                         The requesting User
   * @returns {Promise<Document[]>}                   An array of updated Document instances
   */
  async update(documentClass, operation, user) {
    operation = await this.#configureUpdate(operation);
    return this._updateDocuments(documentClass, operation, user);
  }

  /* -------------------------------------------- */

  /**
   * Validate and configure the parameters of the update operation.
   * @param {DatabaseUpdateOperation} operation       The requested operation
   */
  async #configureUpdate(operation) {
    if ( !Array.isArray(operation.updates) ) {
      throw new Error("The updates provided to the DatabaseBackend#update operation must be an array of data objects");
    }
    await this.#configureOperation(operation);
    operation.diff ??= true;
    operation.recursive ??= true;
    operation.render ??= true;
    return operation;
  }

  /* -------------------------------------------- */

  /**
   * Update Document instances using provided data and operation parameters.
   * @param {typeof Document} documentClass           The Document class definition
   * @param {DatabaseUpdateOperation} operation       Parameters of the update operation
   * @param {BaseUser} [user]                         The requesting User
   * @returns {Promise<Document[]>}                   An array of updated Document instances
   * @abstract
   * @internal
   * @ignore
   */
  async _updateDocuments(documentClass, operation, user) {}

  /* -------------------------------------------- */
  /*  Delete Operations                           */
  /* -------------------------------------------- */

  /**
   * Delete Documents using provided ids and context.
   * It is recommended to use {@link foundry.abstract.Document.deleteDocuments} or
   * {@link foundry.abstract.Document#delete} rather than calling this method directly.
   * @param {typeof Document} documentClass           The Document class definition
   * @param {DatabaseDeleteOperation} operation       Parameters of the delete operation
   * @param {BaseUser} [user]                         The requesting User
   * @returns {Promise<Document[]>}                   An array of deleted Document instances
   */
  async delete(documentClass, operation, user) {
    operation = await this.#configureDelete(operation);
    return this._deleteDocuments(documentClass, operation, user);
  }

  /* -------------------------------------------- */

  /**
   * Validate and configure the parameters of the delete operation.
   * @param {DatabaseDeleteOperation} operation       The requested operation
   */
  async #configureDelete(operation) {
    if ( !Array.isArray(operation.ids) ) {
      throw new Error("The document ids provided to the DatabaseBackend#delete operation must be an array of strings");
    }
    await this.#configureOperation(operation);
    operation.deleteAll ??= false;
    operation.render ??= true;
    return operation;
  }

  /* -------------------------------------------- */

  /**
   * Delete Document instances using provided ids and operation parameters.
   * @param {typeof Document} documentClass           The Document class definition
   * @param {DatabaseDeleteOperation} operation       Parameters of the delete operation
   * @param {BaseUser} [user]                         The requesting User
   * @returns {Promise<Document[]>}                   An array of deleted Document instances
   * @abstract
   * @internal
   * @ignore
   */
  async _deleteDocuments(documentClass, operation, user) {}

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Common database operation configuration steps.
   * @param {DatabaseOperation} operation           The requested operation
   * @returns {Promise<void>}
   */
  async #configureOperation(operation) {
    if ( operation.pack && !this.getCompendiumScopes().includes(operation.pack) ) {
      throw new Error(`Compendium pack "${operation.pack}" is not a valid Compendium identifier`);
    }
    operation.parent = await this._getParent(operation);
    operation.modifiedTime = Date.now();
  }

  /* -------------------------------------------- */

  /**
   * Get the parent Document (if any) associated with a request context.
   * @param {DatabaseOperation} operation           The requested database operation
   * @return {Promise<Document|null>}               The parent Document, or null
   * @internal
   * @ignore
   */
  async _getParent(operation) {
    if ( operation.parent && !(operation.parent instanceof Document) ) {
      throw new Error("A parent Document provided to the database operation must be a Document instance");
    }
    else if ( operation.parent ) return operation.parent;
    if ( operation.parentUuid ) return globalThis.fromUuid(operation.parentUuid, {invalid: true});
    return null;
  }

  /* -------------------------------------------- */

  /**
   * Describe the scopes which are suitable as the namespace for a flag key
   * @returns {string[]}
   */
  getFlagScopes() {}

  /* -------------------------------------------- */

  /**
   * Describe the scopes which are suitable as the namespace for a flag key
   * @returns {string[]}
   */
  getCompendiumScopes() {}

  /* -------------------------------------------- */

  /**
   * Log a database operations message.
   * @param {string} level      The logging level
   * @param {string} message    The message
   * @abstract
   * @protected
   */
  _log(level, message) {}

  /* -------------------------------------------- */

  /**
   * Log a database operation for an embedded document, capturing the action taken and relevant IDs
   * @param {string} action                       The action performed
   * @param {string} type                         The document type
   * @param {abstract.Document[]} documents       The documents modified
   * @param {string} [level=info]                 The logging level
   * @param {abstract.Document} [parent]          A parent document
   * @param {string} [pack]                       A compendium pack within which the operation occurred
   * @protected
   */
  _logOperation(action, type, documents, {parent, pack, level="info"}={}) {
    let msg = (documents.length === 1) ? `${action} ${type}` : `${action} ${documents.length} ${type} documents`;
    if (documents.length === 1) msg += ` with id [${documents[0].id}]`;
    else if (documents.length <= 5) msg += ` with ids: [${documents.map(d => d.id)}]`;
    msg += this.#logContext(parent, pack);
    this._log(level, msg);
  }

  /* -------------------------------------------- */

  /**
   * Construct a standardized error message given the context of an attempted operation
   * @returns {string}
   * @protected
   */
  _logError(user, action, subject, {parent, pack}={}) {
    if ( subject instanceof Document ) {
      subject = subject.id ? `${subject.documentName} [${subject.id}]` : `a new ${subject.documentName}`;
    }
    let msg = `User ${user.name} lacks permission to ${action} ${subject}`;
    return msg + this.#logContext(parent, pack);
  }

  /* -------------------------------------------- */

  /**
   * Determine a string suffix for a log message based on the parent and/or compendium context.
   * @param {Document|null} parent
   * @param {string|null} pack
   * @returns {string}
   */
  #logContext(parent, pack) {
    let context = "";
    if ( parent ) context += ` in parent ${parent.constructor.metadata.name} [${parent.id}]`;
    if ( pack ) context += ` in Compendium ${pack}`;
    return context;
  }
}
