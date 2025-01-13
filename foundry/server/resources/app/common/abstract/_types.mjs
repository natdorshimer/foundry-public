
/**
 * @typedef {Object} DatabaseGetOperation
 * @property {Record<string, any>} query        A query object which identifies the set of Documents retrieved
 * @property {false} [broadcast]                Get requests are never broadcast
 * @property {boolean} [index]                  Return indices only instead of full Document records
 * @property {string[]} [indexFields]           An array of field identifiers which should be indexed
 * @property {string|null} [pack=null]          A compendium collection ID which contains the Documents
 * @property {foundry.abstract.Document|null} [parent=null] A parent Document within which Documents are embedded
 * @property {string} [parentUuid]              A parent Document UUID provided when the parent instance is unavailable
 */

/**
 * @typedef {Object} DatabaseCreateOperation
 * @property {boolean} broadcast                Whether the database operation is broadcast to other connected clients
 * @property {object[]} data                    An array of data objects from which to create Documents
 * @property {boolean} [keepId=false]           Retain the _id values of provided data instead of generating new ids
 * @property {boolean} [keepEmbeddedIds=true]   Retain the _id values of embedded document data instead of generating
 *                                              new ids for each embedded document
 * @property {number} [modifiedTime]            The timestamp when the operation was performed
 * @property {boolean} [noHook=false]           Block the dispatch of hooks related to this operation
 * @property {boolean} [render=true]            Re-render Applications whose display depends on the created Documents
 * @property {boolean} [renderSheet=false]      Render the sheet Application for any created Documents
 * @property {foundry.abstract.Document|null} [parent=null] A parent Document within which Documents are embedded
 * @property {string|null} pack                 A compendium collection ID which contains the Documents
 * @property {string|null} [parentUuid]         A parent Document UUID provided when the parent instance is unavailable
 * @property {(string|object)[]} [_result]      An alias for 'data' used internally by the server-side backend
 */

/**
 * @typedef {Object} DatabaseUpdateOperation
 * @property {boolean} broadcast                Whether the database operation is broadcast to other connected clients
 * @property {object[]} updates                 An array of data objects used to update existing Documents.
 *                                              Each update object must contain the _id of the target Document
 * @property {boolean} [diff=true]              Difference each update object against current Document data and only use
 *                                              differential data for the update operation
 * @property {number} [modifiedTime]            The timestamp when the operation was performed
 * @property {boolean} [recursive=true]         Merge objects recursively. If false, inner objects will be replaced
 *                                              explicitly. Use with caution!
 * @property {boolean} [render=true]            Re-render Applications whose display depends on the created Documents
 * @property {boolean} [noHook=false]           Block the dispatch of hooks related to this operation
 * @property {foundry.abstract.Document|null} [parent=null] A parent Document within which Documents are embedded
 * @property {string|null} pack                 A compendium collection ID which contains the Documents
 * @property {string|null} [parentUuid]         A parent Document UUID provided when the parent instance is unavailable
 * @property {(string|object)[]} [_result]      An alias for 'updates' used internally by the server-side backend
 *
 */

/**
 * @typedef {Object} DatabaseDeleteOperation
 * @property {boolean} broadcast                Whether the database operation is broadcast to other connected clients
 * @property {string[]} ids                     An array of Document ids which should be deleted
 * @property {boolean} [deleteAll=false]        Delete all documents in the Collection, regardless of _id
 * @property {number} [modifiedTime]            The timestamp when the operation was performed
 * @property {boolean} [noHook=false]           Block the dispatch of hooks related to this operation
 * @property {boolean} [render=true]            Re-render Applications whose display depends on the deleted Documents
 * @property {foundry.abstract.Document|null} [parent=null] A parent Document within which Documents are embedded
 * @property {string|null} pack                 A compendium collection ID which contains the Documents
 * @property {string|null} [parentUuid]         A parent Document UUID provided when the parent instance is unavailable
 * @property {(string|object)[]} [_result]      An alias for 'ids' used internally by the server-side backend
 */

/**
 * @typedef {"get"|"create"|"update"|"delete"} DatabaseAction
 */

/**
 * @typedef {DatabaseGetOperation|DatabaseCreateOperation|DatabaseUpdateOperation|DatabaseDeleteOperation} DatabaseOperation
 */

/**
 * @typedef {Object} DocumentSocketRequest
 * @property {string} type                      The type of Document being transacted
 * @property {DatabaseAction} action            The action of the request
 * @property {DatabaseOperation} operation      Operation parameters for the request
 * @property {string} userId                    The id of the requesting User
 * @property {boolean} broadcast                Should the response be broadcast to other connected clients?
 */
