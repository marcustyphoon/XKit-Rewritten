import { inject } from './inject.js';

// eslint-disable-next-line mozilla/reject-top-level-await
export const cssMap = await inject(async () => window.tumblr.getCssMap());

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
