/**
 * The client-side AmbientSound document which extends the common BaseAmbientSound document model.
 * @extends foundry.documents.BaseAmbientSound
 * @mixes ClientDocumentMixin
 *
 * @see {@link Scene}                   The Scene document type which contains AmbientSound documents
 * @see {@link foundry.applications.sheets.AmbientSoundConfig} The AmbientSound configuration application
 */
class AmbientSoundDocument extends CanvasDocumentMixin(foundry.documents.BaseAmbientSound) {}
