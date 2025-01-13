/** @module applications */

export * as types from "./_types.mjs";
export * as api from "./api/_module.mjs";
export * as dice from "./dice/_module.mjs";
export * as elements from "./elements/_module.mjs";
export * as fields from "./forms/fields.mjs";
export * as apps from "./apps/_module.mjs";
export * as sheets from "./sheets/_module.mjs";
export * as ui from "./ui/_module.mjs";

/**
 * A registry of currently rendered ApplicationV2 instances.
 * @type {Map<number, ApplicationV2>}
 */
export const instances = new Map();

/**
 * Parse an HTML string, returning a processed HTMLElement or HTMLCollection.
 * A single HTMLElement is returned if the provided string contains only a single top-level element.
 * An HTMLCollection is returned if the provided string contains multiple top-level elements.
 * @param {string} htmlString
 * @returns {HTMLCollection|HTMLElement}
 */
export function parseHTML(htmlString) {
  const div = document.createElement("div");
  div.innerHTML = htmlString;
  const children = div.children;
  return children.length > 1 ? children : children[0];
}
