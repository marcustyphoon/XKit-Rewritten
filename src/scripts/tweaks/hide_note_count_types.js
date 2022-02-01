import { keyToCss } from '../../util/css_map.js';
import { buildStyle } from '../../util/interface.js';

const styleElement = buildStyle();

export const main = async function () {
  const selector = await keyToCss('noteCountTypes');
  styleElement.textContent = `${selector} { display: none !important; }`;
  document.head.append(styleElement);
};

export const clean = async function () {
  styleElement.remove();
};
