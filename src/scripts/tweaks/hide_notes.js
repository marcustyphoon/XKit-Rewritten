import { keyToClasses } from '../../util/css_map.js';
import { addStyle, removeStyle } from '../../util/interface.js';

const makeRulesString = (template, selectors) =>
  selectors.map(selector => template(selector)).join(' ');

// note: currently breaks timestamp rendering because of
// :not(:empty) + .xkit-timestamp { margin-left: var(--post-padding); }

const template = noteCountButton =>
  `footer .${noteCountButton} { display: none; }`;

let css;

export const main = async function () {
  const noteCountButton = await keyToClasses('noteCountButton');

  css = makeRulesString(template, noteCountButton);
  addStyle(css);
};

export const clean = async function () {
  removeStyle(css);
};
