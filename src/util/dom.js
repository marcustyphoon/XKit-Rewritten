/**
 * Create elements with simple syntax
 *
 * @param {string} tagName - Type of element to create
 * @param {object} [attributes] - Property-value pairs to set as HTML/XML attributes (e.g. { href: '/' })
 * @param {object} [events] - Property-value pairs to set as event listeners (e.g. { click: () => {} })
 * @param {(Node|string)[]} [children] - Zero or more valid children
 * @returns {Element} Element created to specification
 */
export function dom (tagName, attributes = {}, events = {}, children = []) {
  const element = attributes?.xmlns
    ? document.createElementNS(attributes.xmlns, tagName)
    : document.createElement(tagName);

  attributes && Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  events && Object.entries(events).forEach(([type, listener]) => element.addEventListener(type, listener));
  children && element.replaceChildren(...children);

  element.normalize();
  return element;
}

const enLocale = document.documentElement.lang.startsWith('en')
  ? document.documentElement.lang
  : 'en-US';
const andListFormat = new Intl.ListFormat(enLocale, { type: 'conjunction' });
const orListFormat = new Intl.ListFormat(enLocale, { type: 'disjunction' });
const neitherListFormat = new Intl.ListFormat(enLocale, { type: 'unit' });

const listFormatArray = (array, listFormat) => {
  const indexesAsStrings = array.map((_, i) => String(i));

  return listFormat.formatToParts(indexesAsStrings).map(({ type, value }) => {
    if (type === 'element') {
      const i = Number(value);
      return array[i];
    } else {
      return value;
    }
  });
};

/**
 * Formats an array of elements as an English prose list separated.
 *
 * @param {any[]} elements
 * @param {string} andOr
 * @returns {any[]}
 */
export const elementsAsList = (elements, andOr) => {
  switch (andOr) {
    case 'and':
      return listFormatArray(elements, andListFormat);
    case 'or':
      return listFormatArray(elements, orListFormat);
    default:
      return listFormatArray(elements, neitherListFormat);
  }
};
