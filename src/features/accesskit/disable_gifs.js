import { pageModifications } from '../../utils/mutations.js';
import { keyToCss } from '../../utils/css_map.js';
import { dom } from '../../utils/dom.js';
import { buildStyle, postSelector } from '../../utils/interface.js';
import { getPreferences } from '../../utils/preferences.js';

const canvasClass = 'xkit-paused-gif-placeholder';
const posterAttribute = 'data-paused-gif-placeholder';
const labelClass = 'xkit-paused-gif-label';
const containerClass = 'xkit-paused-gif-container';
const backgroundGifClass = 'xkit-paused-background-gif';

let loadingMode;

const hovered = `:is(:hover > *, .${containerClass}:hover *)`;

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

  z-index: 1;
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
:has(> .${labelClass}) > ${keyToCss('loader')}:not(${hovered}) {
  display: none;
}

[${posterAttribute}]:not(${hovered}) {
  visibility: visible !important;
}

.${backgroundGifClass}:not(:hover) {
  background-image: none !important;
  background-color: rgb(var(--secondary-accent));
}

.${backgroundGifClass}:not(:hover) > div {
  color: rgb(var(--black));
}
`);

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
  loadingMode === 'immediate' && await loaded(gifElement);
  posterElement.setAttribute(posterAttribute, '');
};

const pauseGif = async function (gifElement) {
  await loaded(gifElement);
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
      gifElement.after(...pausedGifElements);
      return;
    }

    const posterElement = gifElement.parentElement.querySelector(keyToCss('poster'));
    posterElement?.currentSrc
      ? pauseGifWithPoster(gifElement, posterElement)
      : pauseGif(gifElement);
  });
};

const processBackgroundGifs = function (gifBackgroundElements) {
  gifBackgroundElements.forEach(gifBackgroundElement => {
    gifBackgroundElement.classList.add(backgroundGifClass);
    addLabel(gifBackgroundElement, true);
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

  const gifImage = `
    :is(figure, ${keyToCss('tagImage', 'takeoverBanner')}) img[srcset*=".gif"]:not(${keyToCss('poster')})
  `;
  pageModifications.register(gifImage, processGifs);

  const gifBackgroundImage = `
    ${keyToCss('communityHeaderImage', 'bannerImage')}[style*=".gif"]
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
  $(`.${backgroundGifClass}`).removeClass(backgroundGifClass);
};
