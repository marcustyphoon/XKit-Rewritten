import { pageModifications } from '../../utils/mutations.js';
import { keyToCss } from '../../utils/css_map.js';
import { dom } from '../../utils/dom.js';
import { buildStyle, postSelector } from '../../utils/interface.js';
import { sha256 } from '../../utils/crypto.js';

const contentModifiedVar = '--xkit-paused-gif-content';
const labelClass = 'xkit-paused-gif-label';
const containerClass = 'xkit-paused-gif-container';
const backgroundGifClass = 'xkit-paused-background-gif';

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
}

.${labelClass}::before {
  content: "GIF";
}

.${labelClass}.mini {
  font-size: 0.6rem;
}

.${labelClass}${hovered} {
  display: none;
}

img[style*="${contentModifiedVar}"]:not(${hovered}) {
  content: var(${contentModifiedVar});
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

const pauseGif = function (gifElement) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = gifElement.currentSrc;
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    canvas.toBlob(blob => {
      const blobUrl = URL.createObjectURL(blob);
      gifElement.style.setProperty(contentModifiedVar, `url(${blobUrl})`);
      addLabel(gifElement);
    });
  };
};

const processGifs = function (gifElements) {
  gifElements.forEach(gifElement => {
    if (gifElement.matches(`[style*="${contentModifiedVar}"]`)) return;
    if (gifElement.closest('.block-editor-writing-flow')) return;
    const existingLabelElements = gifElement.parentNode.querySelectorAll(`.${labelClass}`);
    if (existingLabelElements.length) {
      gifElement.after(...existingLabelElements);
      return;
    }

    if (gifElement.complete && gifElement.currentSrc) {
      pauseGif(gifElement);
    } else {
      gifElement.onload = () => pauseGif(gifElement);
    }
  });
};

const sourceUrlRegex = /(?<=url\(["'])[^)]*?\.gifv?(?=["']\))/g;

const pausedBackgroundImageValues = {};

const backgroundStyleElement = buildStyle();
const updateBackgroundStyle = () => {
  backgroundStyleElement.textContent = Object.entries(pausedBackgroundImageValues)
    .map(([id, value]) => `[data-disable-gifs-id="${id}"]:not(:hover) { background-image: ${value} !important; }`)
    .join('\n');
};

const createPausedUrl = (sourceUrl) => new Promise(resolve => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = sourceUrl;
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    canvas.toBlob(blob =>
      resolve(URL.createObjectURL(blob))
    );
  };
});

const processBackgroundGifs = function (gifBackgroundElements) {
  gifBackgroundElements.forEach(async gifBackgroundElement => {
    const sourceValue = gifBackgroundElement.style.backgroundImage;
    const sourceUrl = sourceValue.match(sourceUrlRegex)?.[0];

    if (sourceUrl) {
      const id = await sha256(sourceValue);
      pausedBackgroundImageValues[id] ??= sourceValue.replaceAll(sourceUrlRegex, await createPausedUrl(sourceUrl));
      updateBackgroundStyle();

      gifBackgroundElement.dataset.disableGifsId = id;
    } else {
      gifBackgroundElement.classList.add(backgroundGifClass);
    }
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

export const main = async function () {
  const gifImage = `
    :is(figure, ${keyToCss('tagImage', 'takeoverBanner')}) img[srcset*=".gif"]:not(${keyToCss('poster')})
  `;
  pageModifications.register(gifImage, processGifs);

  const gifBackgroundImage = `
    ${keyToCss('communityHeaderImage', 'bannerImage')}[style*=".gif"]
  `;
  pageModifications.register(gifBackgroundImage, processBackgroundGifs);
  document.documentElement.append(backgroundStyleElement);

  pageModifications.register(
    `:is(${postSelector}, ${keyToCss('blockEditorContainer')}) ${keyToCss('rows')}`,
    processRows
  );
};

export const clean = async function () {
  pageModifications.unregister(processGifs);
  pageModifications.unregister(processBackgroundGifs);
  pageModifications.unregister(processRows);

  [...document.querySelectorAll(`.${containerClass}`)].forEach(wrapper =>
    wrapper.replaceWith(...wrapper.children)
  );

  $(`.${labelClass}`).remove();
  $(`.${backgroundGifClass}`).removeClass(backgroundGifClass);
  $('[data-disable-gifs-id]').removeAttr('data-disable-gifs-id');
  [...document.querySelectorAll(`img[style*="${contentModifiedVar}"]`)]
    .forEach(element => element.style.removeProperty(contentModifiedVar));

  backgroundStyleElement.remove();
};
