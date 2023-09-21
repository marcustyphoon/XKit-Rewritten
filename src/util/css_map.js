import { inject } from './inject.js';

export const cssMap = await inject('getCssMap');

const missingKeys = new Set();

/**
 * @param {...string} keys - One or more element source names
 * @returns {string[]} An array of generated classnames from the CSS map
 */
export const keyToClasses = (...keys) => {
  keys.filter(key => !cssMap[key]).forEach(key => missingKeys.add(key));
  return keys.flatMap(key => cssMap[key]).filter(Boolean);
};

setTimeout(async () => {
  if (missingKeys.size) {
    const message = `XKit Rewritten missing css keys: ${[...missingKeys].join(', ')}`;
    console.log(message);
    const { notify } = await import(browser.runtime.getURL('/util/notifications.js'));
    notify(message);
  }
}, 1000);

/**
 * @param {...string} keys - One or more element source names
 * @returns {string} - A CSS :is() selector which targets all elements that match any of the given source names
 */
export const keyToCss = function (...keys) {
  const classes = keyToClasses(...keys);
  return `:is(${classes.map(className => `.${className}`).join(', ')})`;
};
