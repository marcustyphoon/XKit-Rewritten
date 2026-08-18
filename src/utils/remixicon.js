import { memoize } from './memoize.js';

const getSourceIcon = memoize(async path => {
  const iconUrl = typeof path === 'function' ? path('./icon.svg') : browser.runtime.getURL(path);
  const iconResponse = await fetch(iconUrl);
  const iconText = await iconResponse.text();
  return new DOMParser().parseFromString(iconText, 'image/svg+xml').firstElementChild;
});

/**
 * @see https://remixicon.com/
 * @param {string|(string) => string} path Icon path to use, or import.meta.resolve to use local icon
 * @returns {Promise<SVGElement>} an SVG element that renders the specified icon
 */
export const buildSvg = path => getSourceIcon(path).then(sourceIcon => sourceIcon.cloneNode(true));
