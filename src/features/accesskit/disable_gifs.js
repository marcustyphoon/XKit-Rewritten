import { pageModifications } from '../../utils/mutations.js';
import { keyToCss } from '../../utils/css_map.js';
import { dom } from '../../utils/dom.js';
import { buildStyle, postSelector } from '../../utils/interface.js';
import { getPreferences } from '../../utils/preferences.js';
import { memoize } from '../../utils/memoize.js';

const canvasClass = 'xkit-paused-gif-placeholder';
const posterAttribute = 'data-paused-gif-placeholder';
const pausedContentVar = '--xkit-paused-gif-content';
const labelClass = 'xkit-paused-gif-label';
const containerClass = 'xkit-paused-gif-container';
const pausedBackgroundImageVar = '--xkit-paused-gif-background-image';
const hasLoadingContentImageAttribute = 'data-paused-gif-content-loading';
const loadingBackgroundImageAttribute = 'data-paused-gif-background-loading';

let enabledTimestamp;

let loadingMode;

const hovered = `:is(:hover > *, .${containerClass}:hover *, a:hover + div *)`;

export const styleElement = buildStyle(`
.${labelClass} {
  position: absolute;
  top: 1ch;
  right: 1ch;

  height: 1em;
  padding: 0.6ch;
  border-radius: 3px;

  background-color: rgb(var(--black));
  color: rgb(var(--white));
  font-size: 1rem;
  font-weight: bold;
  line-height: 1em;
}

.${labelClass}::before {
  content: "GIF";
}

.${labelClass}.mini {
  font-size: 0.6rem;
}

.${canvasClass} {
  position: absolute;
  visibility: visible;
}

.${canvasClass}${hovered},
.${labelClass}${hovered},
img:has(~ .${canvasClass}):not(${hovered}),
img:has(~ [${posterAttribute}]):not(${hovered}),
${keyToCss('loader')}:has(~ .${labelClass}):not(${hovered}) {
  display: none;
}

[${posterAttribute}]:not(${hovered}) {
  visibility: visible !important;
}

img[style*="${pausedContentVar}"]:not(${hovered}) {
  content: var(${pausedContentVar});
}
[style*="${pausedBackgroundImageVar}"]:not(${hovered}) {
  background-image: var(${pausedBackgroundImageVar}) !important;
}

[${hasLoadingContentImageAttribute}] > img:not(${hovered}) {
  filter: blur(40px);
}
[${hasLoadingContentImageAttribute}] {
  contain: paint;
}
[${loadingBackgroundImageAttribute}]:not(${hovered})::before {
  content: "";
  backdrop-filter: blur(40px);
  position: absolute;
  inset: 0;
  z-index: -1;
}
[${loadingBackgroundImageAttribute}] {
  contain: paint;
  filter: unset !important;
}
`);

const isAnimatedDefault = true;
const isAnimated = memoize(async (sourceUrl) => {
  // treat all GIFs like they're animated
  if (sourceUrl.includes('.gif')) return true;

  if (typeof ImageDecoder !== 'function') return isAnimatedDefault;
  /* globals ImageDecoder */

  const response = await fetch(sourceUrl);

  const contentType = response.headers.get('Content-Type');
  const supported = await ImageDecoder.isTypeSupported(contentType);
  if (!supported) return isAnimatedDefault;

  const decoder = new ImageDecoder({
    type: contentType,
    data: response.body,
    preferAnimation: true
  });
  await decoder.tracks.ready;
  return decoder.tracks.selectedTrack.animated;
});

const addLabel = (element, inside = false) => {
  if (element.parentNode.querySelector(`.${labelClass}`) === null) {
    const gifLabel = document.createElement('p');
    gifLabel.className = element.clientWidth && element.clientWidth < 150
      ? `${labelClass} mini`
      : labelClass;

    inside ? element.append(gifLabel) : element.parentNode.append(gifLabel);
  }
};

const pauseGifWithPoster = async function (gifElement, posterElement) {
  addLabel(gifElement);
  gifElement.decoding = 'sync';
  loadingMode === 'immediate' && await loaded(gifElement);
  posterElement.setAttribute(posterAttribute, '');
};

const pauseGif = async function (gifElement) {
  await loaded(gifElement);
  if (!await isAnimated(gifElement.currentSrc)) return;
  gifElement.decode();

  const image = new Image();
  image.src = gifElement.currentSrc;
  image.onload = () => {
    if (gifElement.parentNode && gifElement.parentNode.querySelector(`.${canvasClass}`) === null) {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.className = gifElement.className;
      canvas.classList.add(canvasClass);
      canvas.getContext('2d').drawImage(image, 0, 0);
      gifElement.parentNode.append(canvas);
      addLabel(canvas);
    }
  };
};

const loaded = gifElement =>
  (gifElement.complete && gifElement.currentSrc) ||
  new Promise(resolve => gifElement.addEventListener('load', resolve, { once: true }));

const processGifs = function (gifElements) {
  gifElements.forEach(async gifElement => {
    if (gifElement.closest('.block-editor-writing-flow')) return;
    const pausedGifElements = [
      ...gifElement.parentNode.querySelectorAll(`.${canvasClass}`),
      ...gifElement.parentNode.querySelectorAll(`.${labelClass}`)
    ];
    if (pausedGifElements.length) {
      gifElement.parentNode.append(...pausedGifElements);
      return;
    }

    const posterElement = gifElement.parentElement.querySelector(keyToCss('poster'));
    posterElement?.currentSrc
      ? pauseGifWithPoster(gifElement, posterElement)
      : pauseGif(gifElement);
  });
};

const pauseContentGif = async function (gifElement) {
  Date.now() - enabledTimestamp >= 100 && gifElement.parentElement?.setAttribute(hasLoadingContentImageAttribute, '');
  addLabel(gifElement);
  await loaded(gifElement);
  gifElement.style.setProperty(pausedContentVar, `url(${await createPausedUrl(gifElement.currentSrc)})`);
  gifElement.parentElement?.removeAttribute(hasLoadingContentImageAttribute);
};

const processContentGifs = function (gifElements) {
  gifElements.forEach(gifElement => {
    if (gifElement.closest('.block-editor-writing-flow')) return;
    const existingLabelElements = gifElement.parentNode.querySelectorAll(`.${labelClass}`);
    if (existingLabelElements.length) {
      gifElement.after(...existingLabelElements);
      return;
    }
    pauseContentGif(gifElement);
  });
};

const sourceUrlRegex = /(?<=url\(["'])[^)]*?\.gifv?(?=["']\))/g;

const pausedUrlCache = {};
const createPausedUrl = (sourceUrl) => {
  pausedUrlCache[sourceUrl] ??= new Promise(resolve => {
    fetch(sourceUrl, { headers: { Accept: 'image/webp,*/*' } })
      .then(response => response.blob())
      .then(blob => createImageBitmap(blob))
      .then(imageBitmap => {
        const canvas = document.createElement('canvas');
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        canvas.getContext('2d').drawImage(imageBitmap, 0, 0);
        canvas.toBlob(blob =>
          resolve(URL.createObjectURL(blob))
        );
      });
  });
  return pausedUrlCache[sourceUrl];
};

const processBackgroundGifs = function (gifBackgroundElements) {
  gifBackgroundElements.forEach(async gifBackgroundElement => {
    const sourceValue = gifBackgroundElement.style.backgroundImage;
    const sourceUrl = sourceValue.match(sourceUrlRegex)?.[0];

    if (sourceUrl) {
      Date.now() - enabledTimestamp >= 100 && gifBackgroundElement.setAttribute(loadingBackgroundImageAttribute, '');
      addLabel(gifBackgroundElement, true);
      gifBackgroundElement.style.setProperty(
        pausedBackgroundImageVar,
        sourceValue.replaceAll(sourceUrlRegex, await createPausedUrl(sourceUrl))
      );
      gifBackgroundElement.removeAttribute(loadingBackgroundImageAttribute);
    }
  });
};

const processRows = function (rowsElements) {
  rowsElements.forEach(rowsElement => {
    [...rowsElement.children].forEach(row => {
      if (!row.querySelector('figure')) return;

      if (row.previousElementSibling?.classList?.contains(containerClass)) {
        row.previousElementSibling.append(row);
      } else {
        const wrapper = dom('div', { class: containerClass });
        row.replaceWith(wrapper);
        wrapper.append(row);
      }
    });
  });
};

const onStorageChanged = async function (changes, areaName) {
  if (areaName !== 'local') return;

  const { 'accesskit.preferences.disable_gifs_loading_mode': modeChanges } = changes;
  if (modeChanges?.oldValue === undefined) return;

  loadingMode = modeChanges.newValue;
};

export const main = async function () {
  ({ disable_gifs_loading_mode: loadingMode } = await getPreferences('accesskit'));
  enabledTimestamp = Date.now();

  const gifImage = `
    :is(figure, ${keyToCss('tagImage', 'takeoverBanner', 'videoHubsFeatured')}) img:is([srcset*=".gif"], [src*=".gif"], [srcset*=".webp"], [src*=".webp"]):not(${keyToCss('poster')})
  `;
  pageModifications.register(gifImage, processGifs);
  const gifContentImage = `
    :is(main.labs, ${keyToCss('headerBanner', 'headerImage', 'typeaheadRow', 'linkCard')}) img:is([srcset*=".gif"], [src*=".gif"]):not(${keyToCss('poster')})
  `;
  pageModifications.register(gifContentImage, processContentGifs);

  const gifBackgroundImage = `
    ${keyToCss('communityHeaderImage', 'communityCategoryImage', 'bannerImage', 'videoHubCardWrapper')}[style*=".gif"]
  `;
  pageModifications.register(gifBackgroundImage, processBackgroundGifs);

  pageModifications.register(
    `:is(${postSelector}, ${keyToCss('blockEditorContainer')}) ${keyToCss('rows')}`,
    processRows
  );

  browser.storage.onChanged.addListener(onStorageChanged);
};

export const clean = async function () {
  browser.storage.onChanged.removeListener(onStorageChanged);

  pageModifications.unregister(processGifs);
  pageModifications.unregister(processBackgroundGifs);
  pageModifications.unregister(processRows);

  [...document.querySelectorAll(`.${containerClass}`)].forEach(wrapper =>
    wrapper.replaceWith(...wrapper.children)
  );

  $(`.${canvasClass}, .${labelClass}`).remove();
  [...document.querySelectorAll(`img[style*="${pausedContentVar}"]`)]
    .forEach(element => element.style.removeProperty(pausedContentVar));
  [...document.querySelectorAll(`img[style*="${pausedBackgroundImageVar}"]`)]
    .forEach(element => element.style.removeProperty(pausedBackgroundImageVar));
  $(`[${hasLoadingContentImageAttribute}]`).removeAttr(hasLoadingContentImageAttribute);
  $(`[${loadingBackgroundImageAttribute}]`).removeAttr(loadingBackgroundImageAttribute);
};
