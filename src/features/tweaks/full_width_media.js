import { keyToCss } from '../../utils/css_map.js';
import { buildStyle } from '../../utils/interface.js';

const extraClassSpecificity = '[class]';

export const styleElement = buildStyle(`
${keyToCss('rows')} ${keyToCss('videoBlock')} ${keyToCss('embeddedPlayer')},
${keyToCss('rows')} ${keyToCss('videoPlayer')} {
  outline: 3px dotted orange;
  outline-offset: -10px;

  border-radius: 0;
}

${keyToCss('rows')} ${keyToCss('videoBlock')} {
  width: 100%;
  margin-left: unset;
  margin-right: unset;
}

${keyToCss('rows')}
  ${keyToCss('row')}${extraClassSpecificity}
  > div:has(> button:first-child)
  + div:has(> button:first-child) {
  margin-left: unset;
}

${keyToCss('rows')} ${keyToCss('row')}${extraClassSpecificity} {
  padding-left: unset;
  padding-right: unset;
}

${keyToCss('rows')} ${keyToCss('row')} ${keyToCss('unstretched')} {
  padding-left: 8px;
  padding-right: 8px;
}


${keyToCss('rows')}
  :is(
    ${keyToCss('rowWithImages')} > [class],
    ${keyToCss('rowWithImages')} > [class] > div,
    ${keyToCss('rowWithImages')} img,
    ${keyToCss('rowWithImages')} button
  ) {
  outline: 3px dotted purple;
  outline-offset: -10px;

  border-radius: unset !important;
}

${keyToCss('rows')}
  :is(
    ${keyToCss('rowWithImages')} > button,
    ${keyToCss('rowWithImages')} > div > button,
    ${keyToCss('rowWithImages')} > figure > div
  ):after {
  border: none !important;
}
`);
