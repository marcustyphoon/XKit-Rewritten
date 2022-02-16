import { keyToClasses } from '../../util/css_map.js';
import { addStyle, removeStyle } from '../../util/interface.js';

const makeRulesString = (template, selectors) =>
  selectors.map(selector => template(selector)).join(' ');

const template = count =>
  `a[href$="/followers"] > .${count} { display: none !important; }`;

let css;

export const main = async function () {
  const count = await keyToClasses('count');

  css = makeRulesString(template, count);
  addStyle(css);
};

export const clean = async function () {
  removeStyle(css);
};
