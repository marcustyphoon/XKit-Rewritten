import { svg, use } from './dom.js';
import { memoize } from './memoize.js';

const getIconContentId = memoize(iconUrl => {
  const id = CSS.escape(`xkit-icon-${new URL(iconUrl).pathname}-${Date.now()}`);
  fetch(iconUrl)
    .then(response => response.text())
    .then(responseText => {
      const responseDocument = (new DOMParser()).parseFromString(responseText, 'image/svg+xml');
      const iconElement = responseDocument.firstElementChild;
      iconElement.style.display = 'none';
      iconElement.firstElementChild.id = id;
      document.head.appendChild(iconElement);
    });
  return id;
});

/**
 * @param {string} iconUrl Icon url to use, such as one produced by import.meta.resolve or browser.runtime.getURL
 * @returns {SVGElement} an SVG element that renders the specified icon
 */
export const buildSvg = iconUrl => svg({}, [use({ href: `#${getIconContentId(iconUrl)}` })]);
