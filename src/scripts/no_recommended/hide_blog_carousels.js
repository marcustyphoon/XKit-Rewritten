import { keyToCss } from '../../util/css_map.js';
import { addStyle, removeStyle } from '../../util/interface.js';
import { onNewPosts } from '../../util/mutations.js';

const hiddenClass = 'xkit-no-recommended-blog-carousels-hidden';

const css = `
  .${hiddenClass} { position: relative; }
  .${hiddenClass} > div { visibility: hidden; position: absolute; max-width: 100%; }
`;

let blogCarouselSelector;
let listTimelineObjectSelector;

const hideBlogCarousels = async function () {
  [...document.querySelectorAll(blogCarouselSelector)]
    .map(blogCarousel => blogCarousel.closest(listTimelineObjectSelector))
    .forEach(listTimelineObject => {
      listTimelineObject?.classList.add(hiddenClass);
      listTimelineObject?.previousElementSibling.classList.add(hiddenClass);
    });
};

export const main = async function () {
  blogCarouselSelector = await keyToCss('blogCarousel');
  listTimelineObjectSelector = await keyToCss('listTimelineObject');

  addStyle(css);

  onNewPosts.addListener(hideBlogCarousels);
  hideBlogCarousels();
};

export const clean = async function () {
  removeStyle(css);

  onNewPosts.removeListener(hideBlogCarousels);
  $(`.${hiddenClass}`).removeClass(hiddenClass);
};
