import { keyToClasses } from '../../util/css_map.js';
import { addStyle, removeStyle } from '../../util/interface.js';

const makeRulesString = (template, selectors) =>
  selectors.map(selector => template(selector)).join(' ');

const expandTags = tags => `article .${tags} { max-height: inherit; }`;
const hideSeeAll = seeAll => `article .${seeAll} { display: none; }`;

let css;

export const main = async function () {
  const tags = await keyToClasses('tags');
  const seeAll = await keyToClasses('seeAll');

  css = [
    makeRulesString(expandTags, tags),
    makeRulesString(hideSeeAll, seeAll)
  ].join(' ');
  addStyle(css);
};

export const clean = async function () {
  removeStyle(css);
};
