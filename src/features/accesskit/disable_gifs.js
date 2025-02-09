import { pageModifications } from '../../utils/mutations.js';
import { keyToCss } from '../../utils/css_map.js';
import { dom } from '../../utils/dom.js';
import { buildStyle, postSelector } from '../../utils/interface.js';

const canvasClass = 'xkit-paused-gif-placeholder';
const labelClass = 'xkit-paused-gif-label';
const containerClass = 'xkit-paused-gif-container';
const pausedBackgroundImageVar = '--xkit-paused-gif-background-image';
const loadingBackgroundImageAttribute = 'data-paused-gif-background-loading';

let enabledTimestamp;

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

  background-color: rgb(var(--white));
}

*:hover > .${canvasClass},
*:hover > .${labelClass},
.${containerClass}:hover .${canvasClass},
.${containerClass}:hover .${labelClass} {
  display: none;
}

[style*="${pausedBackgroundImageVar}"]:not(:hover) {
  background-image: var(${pausedBackgroundImageVar}) !important;
}

[${loadingBackgroundImageAttribute}]:not(:hover)::before {
  content: "";
  backdrop-filter: blur(40px);
  position: absolute;
  inset: 0;
  z-index: -1;
}
[${loadingBackgroundImageAttribute}]:not(:hover) {
  contain: paint;
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
      addLabel(gifElement);
    }
  };
};

const processGifs = function (gifElements) {
  gifElements.forEach(gifElement => {
    if (gifElement.closest('.block-editor-writing-flow')) return;
    const pausedGifElements = [
      ...gifElement.parentNode.querySelectorAll(`.${canvasClass}`),
      ...gifElement.parentNode.querySelectorAll(`.${labelClass}`)
    ];
    if (pausedGifElements.length) {
      gifElement.after(...pausedGifElements);
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
    // "tumblr tv" video cards may be initially rendered with the wrong background
    if (!gifBackgroundElement.matches('[style*=".gif"]')) await new Promise(requestAnimationFrame);
    if (!gifBackgroundElement.matches('[style*=".gif"]')) return;

    const sourceValue = gifBackgroundElement.style.backgroundImage;
    const sourceUrl = sourceValue.match(sourceUrlRegex)?.[0];

    if (sourceUrl) {
      Date.now() - enabledTimestamp >= 100 && gifBackgroundElement.setAttribute(loadingBackgroundImageAttribute, '');
      gifBackgroundElement.style.setProperty(
        pausedBackgroundImageVar,
        sourceValue.replaceAll(sourceUrlRegex, await createPausedUrl(sourceUrl))
      );
      addLabel(gifBackgroundElement, true);
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

export const main = async function () {
  enabledTimestamp = Date.now();

  const gifImage = `
    :is(figure, ${keyToCss('tagImage', 'takeoverBanner', 'videoHubsFeatured')}) img:is([srcset*=".gif"], [src*=".gif"]):not(${keyToCss('poster')})
  `;
  pageModifications.register(gifImage, processGifs);

  const gifBackgroundImage = `
    ${keyToCss('communityHeaderImage', 'bannerImage', 'videoHubCardWrapper')}
  `;
  pageModifications.register(gifBackgroundImage, processBackgroundGifs);

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

  $(`.${canvasClass}, .${labelClass}`).remove();
  [...document.querySelectorAll(`img[style*="${pausedBackgroundImageVar}"]`)]
    .forEach(element => element.style.removeProperty(pausedBackgroundImageVar));
  $(`[${loadingBackgroundImageAttribute}]`).removeAttr(loadingBackgroundImageAttribute);
};
