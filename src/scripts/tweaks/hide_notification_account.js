import { keyToClasses } from '../../util/css_map.js';
import { translate } from '../../util/language_data.js';
import { addStyle, removeStyle } from '../../util/interface.js';

const makeRulesString = (template, selectors, ...rest) =>
  selectors.map(selector => template(selector, ...rest)).join(' ');

const template = (notificationBadge, { Account }) =>
  `button[aria-label="${Account}"] .${notificationBadge} { display: none; }`;

let css;

export const main = async function () {
  const notificationBadge = await keyToClasses('notificationBadge');
  const Account = await translate('Account');

  css = makeRulesString(template, notificationBadge, { Account });
  addStyle(css);
};

export const clean = async function () {
  removeStyle(css);
};
