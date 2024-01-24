import { buildStyle } from '../../util/interface.js';

const styleElement = buildStyle(`
html, body {
  overscroll-behavior: none !important;
}
`);

export const main = async () => document.documentElement.append(styleElement);
export const clean = async () => styleElement.remove();
