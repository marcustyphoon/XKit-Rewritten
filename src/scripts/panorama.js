import { keyToCss } from '../util/css_map.js';
import { buildStyle } from '../util/interface.js';
import { pageModifications } from '../util/mutations.js';
import { getPreferences } from '../util/preferences.js';

const navigationWrapperBasis = 240;
const navigationWrapperMargin = 20;
const mainContentWrapperMinWidth = 902;
const mainStyleMinWidth = navigationWrapperBasis + navigationWrapperMargin + mainContentWrapperMinWidth;

const sidebarMaxWidth = 320;
const mainRightPadding = 20;
const mainRightBorder = 1;
const sidebarOffset = sidebarMaxWidth + mainRightPadding + mainRightBorder;

const expandClass = 'xkit-panorama-expand-media';
const maxPostWidthVar = '--xkit-panorama-post-width';
const aspectRatioVar = '--xkit-panorama-aspect-ratio';

const createPostStyles = column => `
${column}
  :is(
    ${keyToCss('cell')},
    article,
    article > header,
    article ${keyToCss('reblog')}
  ) {
  max-width: unset;
}

/* Center non-expanded content */
body:not(.${expandClass}) ${column}
  :is(
    ${keyToCss('videoBlock', 'audioBlock', 'link', 'pollBlock')},
    figure${keyToCss('imageBlock')}:not(${keyToCss('unstretched')})
  ) {
  margin: 0 auto;
  max-width: 540px;
}

/* Widen + lock aspect ratios of expanded content */
body.${expandClass} ${column}
  :is(
    ${keyToCss('videoBlock', 'audioBlock', 'link', 'pollBlock')},
    ${keyToCss('videoBlock')} iframe
  ) {
  max-width: unset !important;
}
body.${expandClass} ${column} ${keyToCss('videoBlock')} iframe[style*="${aspectRatioVar}"] {
  aspect-ratio: var(${aspectRatioVar});
  height: unset !important;
}
body.${expandClass} ${column} a > ${keyToCss('withImage')} {
  aspect-ratio: 2;
  height: unset !important;
}

/* Fix ad containers */
${column}
  :is(
    header:has(+ [data-is-resizable="true"][style="width: 540px;"]),
    [data-is-resizable="true"][style="width: 540px;"],
    ${keyToCss('takeoverBanner')}
  ) {
  width: unset !important;
}
`;

const mainContentWrapper = `${keyToCss('mainContentWrapper')}:not(${keyToCss('mainContentIsMasonry', 'mainContentIsFullWidth')})`;
const mainPostColumn = `main${keyToCss('postColumn', 'postsColumn')}`;
const mainStyleElement = buildStyle(`
${mainContentWrapper}:has(> div > div > ${mainPostColumn}) {
  flex-grow: 1;
  max-width: calc(var(${maxPostWidthVar}) + ${sidebarOffset}px);
}
${mainContentWrapper} > div:has(> div > ${mainPostColumn}) {
  max-width: unset;
}
${mainContentWrapper} > div > div:has(> ${mainPostColumn}) {
  max-width: calc(100% - ${sidebarOffset}px);
}
${mainContentWrapper} > div > div > ${mainPostColumn} {
  max-width: 100%;
}
${keyToCss('queueSettings')} {
  box-sizing: border-box;
  width: 100%;
}
` + createPostStyles(mainPostColumn));
mainStyleElement.media = `(min-width: ${mainStyleMinWidth}px)`;

const patioWidePostColumn = `[id]${keyToCss('columnWide')}`;
const patioStyleElement = buildStyle(`
${patioWidePostColumn} {
  width: min(var(${maxPostWidthVar}), 100vw);
}
` + createPostStyles(patioWidePostColumn));

const processVideoIframes = iframes => iframes.forEach(iframe => {
  const { maxWidth, height } = iframe.style;
  if (maxWidth && height) {
    iframe.style.setProperty(
      aspectRatioVar,
      `${maxWidth.replace('px', '')} / ${height.replace('px', '')}`
    );
  }
});

export const onStorageChanged = async (changes, areaName) =>
  Object.keys(changes).some(key => key.startsWith('panorama')) && main();

export const main = async () => {
  const { maxPostWidth: maxPostWidthString, expandPostMedia } = await getPreferences('panorama');

  const maxPostWidth = Number(maxPostWidthString.trim().replace('px', '')) || 0;
  document.body.style.setProperty(maxPostWidthVar, `${Math.max(maxPostWidth, 540)}px`);
  document.body.classList[expandPostMedia ? 'add' : 'remove'](expandClass);

  document.documentElement.append(mainStyleElement, patioStyleElement);

  pageModifications.register(
    `${keyToCss('videoBlock')} iframe[style*="max-width"][style*="height"]`,
    processVideoIframes
  );
};

export const clean = async () => {
  pageModifications.unregister(processVideoIframes);
  [...document.querySelectorAll(`iframe[style*="${aspectRatioVar}"]`)].forEach(el =>
    el.style.removeProperty(aspectRatioVar)
  );

  document.body.style.removeProperty(maxPostWidthVar);
  document.body.classList.remove(expandClass);

  mainStyleElement.remove();
  patioStyleElement.remove();
};
