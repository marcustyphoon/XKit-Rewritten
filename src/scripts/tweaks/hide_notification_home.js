import { keyToClasses } from '../../util/css_map.js';
import { addStyle, removeStyle } from '../../util/interface.js';

const makeRulesString = (template, selectors) =>
  selectors.map(selector => template(selector)).join(' ');

const template = notificationBadge =>
  `a[href="/dashboard"] > .${notificationBadge} { display: none; }`;

let css;

export const main = async function () {
  const notificationBadge = await keyToClasses('notificationBadge');

  css = makeRulesString(template, notificationBadge);
  addStyle(css);
};

export const clean = async function () {
  removeStyle(css);
};
