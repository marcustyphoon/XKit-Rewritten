import { translate } from '../../util/language_data.js';
import { addStyle, removeStyle } from '../../util/interface.js';

let css;

export const main = async function () {
  const Share = await translate('Share');

  css = `article button[aria-label="${Share}"] { display: none; }`;
  addStyle(css);
};

export const clean = async function () {
  removeStyle(css);
};
