import { keyToClasses } from '../../util/css_map.js';
import { translate } from '../../util/language_data.js';
import { addStyle, removeStyle } from '../../util/interface.js';

const makeRulesString = (template, selectors, ...rest) =>
  selectors.map(selector => template(selector, ...rest)).join(' ');

const template = (notificationBadge, { Activity }) =>
  `button[aria-label="${Activity}"] .${notificationBadge} { display: none; }`;

let css;

export const main = async function () {
  const notificationBadge = await keyToClasses('notificationBadge');
  const Activity = await translate('Activity');

  css = makeRulesString(template, notificationBadge, { Activity });
  addStyle(css);
};

export const clean = async function () {
  removeStyle(css);
};
