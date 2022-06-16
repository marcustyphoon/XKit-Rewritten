import { inject } from './inject.js';

console.log('css_map.js loaded, loading cssMap');

export const cssMap = await inject(async () => window.tumblr.getCssMap());

console.log('cssMap: ', cssMap);

/**
 * @param {...string} keys - One or more element source names
 * @returns {string[]} An array of generated classnames from the CSS map
 */
export const keyToClasses = (...keys) => keys.flatMap(key => cssMap[key]).filter(Boolean);

/**
 * @param {...string} keys - One or more element source names
 * @returns {string} - A CSS :is() selector which targets all elements that match any of the given source names
 */
export const keyToCss = function (...keys) {
  const classes = keyToClasses(...keys);
  return `:is(${classes.map(className => `.${className}`).join(', ')})`;
};
