/**
 * Custom HTMLElement implementations for use in template rendering.
 * @module elements
 */

import HTMLDocumentTagsElement from "./document-tags.mjs";
import HTMLFilePickerElement from "./file-picker.mjs";
import HTMLHueSelectorSlider from "./hue-slider.mjs";
import {HTMLMultiSelectElement, HTMLMultiCheckboxElement} from "./multi-select.mjs";
import HTMLStringTagsElement from "./string-tags.mjs";
import HTMLColorPickerElement from "./color-picker.mjs";
import HTMLRangePickerElement from "./range-picker.mjs";
import HTMLProseMirrorElement from "./prosemirror-editor.mjs";

export {default as AbstractFormInputElement} from "./form-element.mjs";
export {default as HTMLColorPickerElement} from "./color-picker.mjs";
export {default as HTMLDocumentTagsElement} from "./document-tags.mjs";
export {default as HTMLFilePickerElement} from "./file-picker.mjs";
export {default as HTMLHueSelectorSlider} from "./hue-slider.mjs"
export {default as HTMLRangePickerElement} from "./range-picker.mjs"
export {default as HTMLStringTagsElement} from "./string-tags.mjs"
export {default as HTMLProseMirrorElement} from "./prosemirror-editor.mjs";
export * from "./multi-select.mjs";

// Define custom elements
window.customElements.define(HTMLColorPickerElement.tagName, HTMLColorPickerElement);
window.customElements.define(HTMLDocumentTagsElement.tagName, HTMLDocumentTagsElement);
window.customElements.define(HTMLFilePickerElement.tagName, HTMLFilePickerElement);
window.customElements.define(HTMLHueSelectorSlider.tagName, HTMLHueSelectorSlider);
window.customElements.define(HTMLMultiSelectElement.tagName, HTMLMultiSelectElement);
window.customElements.define(HTMLMultiCheckboxElement.tagName, HTMLMultiCheckboxElement);
window.customElements.define(HTMLRangePickerElement.tagName, HTMLRangePickerElement);
window.customElements.define(HTMLStringTagsElement.tagName, HTMLStringTagsElement);
window.customElements.define(HTMLProseMirrorElement.tagName, HTMLProseMirrorElement);
