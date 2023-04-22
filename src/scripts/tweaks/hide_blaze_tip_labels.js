import { keyToCss } from '../../util/css_map.js';
import { buildStyle, postSelector } from '../../util/interface.js';

const styleElement = buildStyle(`
${postSelector} ${keyToCss('igniteButton', 'tippingButton')} > ${keyToCss('label')} {
  display: none;
}
`);

export const main = async () => document.documentElement.append(styleElement);
export const clean = async () => styleElement.remove();
