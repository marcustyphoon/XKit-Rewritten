import { keyToClasses } from '../../util/css_map.js';
import { translate } from '../../util/language_data.js';
import { addStyle, removeStyle } from '../../util/interface.js';

const makeRulesString = (template, selectors, ...rest) =>
  selectors.map(selector => template(selector, ...rest)).join(' ');

const template = (notificationBadge, { Messaging }) =>
  `button[aria-label="${Messaging}"] .${notificationBadge} { display: none; }`;

let css;

export const main = async function () {
  const notificationBadge = await keyToClasses('notificationBadge');
  const Messaging = await translate('Messaging');

  css = makeRulesString(template, notificationBadge, { Messaging });
  addStyle(css);
};

export const clean = async function () {
  removeStyle(css);
};
