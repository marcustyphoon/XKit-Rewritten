import { keyToCss } from '../util/css_map.js';
import { buildStyle } from '../util/interface.js';
import { pageModifications } from '../util/mutations.js';
import { getPreferences } from '../util/preferences.js';

const navigationWrapperBasis = 240;
const navigationWrapperMargin = 20;
const mainContentWrapperBasis = 966;
const mainStyleMinWidth = navigationWrapperBasis + navigationWrapperMargin + mainContentWrapperBasis;

const sidebarMaxWidth = 320;
const mainRightPadding = 20;
const mainRightBorder = 1;
const sidebarOffset = sidebarMaxWidth + mainRightPadding + mainRightBorder;

const maxPostWidthVar = '--panorama-post-width';
const aspectRatioVar = '--panorama-aspect-ratio';

const createPostStyles = postColumn => `
${postColumn}
  :is(
    ${keyToCss('cell')},
    article,
    article > header,
    article ${keyToCss('reblog', 'videoBlock', 'audioBlock', 'link')}
  ) {
  max-width: 100%;
}

${postColumn} article [role="link"] > a > ${keyToCss('withImage')} {
  height: unset;
  aspect-ratio: 2;
}
${postColumn} article ${keyToCss('videoBlock')} iframe {
  max-width: none !important;
}
${postColumn}
  :is(
    [data-is-resizable="true"][style="width: 540px;"],
    ${keyToCss('takeoverBanner')}
  ) {
  width: unset !important;
}
${postColumn} iframe[style*="${aspectRatioVar}"] {
  aspect-ratio: var(${aspectRatioVar});
  height: unset !important;
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

const patioPostColumn = `[id]${keyToCss('columnWide')}`;
const patioStyleElement = buildStyle(`
${patioPostColumn} {
  width: min(var(${maxPostWidthVar}), 100vw);
}
` + createPostStyles(patioPostColumn));

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
  const { maxPostWidth: maxPostWidthString } = await getPreferences('panorama');
  const maxPostWidth = Number(maxPostWidthString.trim().replace('px', '')) || 0;

  document.body.style.setProperty(maxPostWidthVar, `${Math.max(maxPostWidth, 540)}px`);

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

  mainStyleElement.remove();
  patioStyleElement.remove();
};
