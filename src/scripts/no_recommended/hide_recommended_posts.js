import { buildStyle, filterPostElements } from '../../util/interface.js';
import { onNewPosts } from '../../util/mutations.js';
import { exposeTimelines, timelineObject } from '../../util/react_props.js';

const hiddenClass = 'xkit-no-recommended-posts-hidden';
const timeline = /\/v2\/timeline\/dashboard/;
const includeFiltered = true;

const styleElement = buildStyle(`.${hiddenClass} article { display: none; }`);

const processPosts = async function (postElements) {
  await exposeTimelines();

  filterPostElements(postElements, { timeline, includeFiltered }).forEach(async postElement => {
    const { recommendationReason } = await timelineObject(postElement.dataset.id);
    if (!recommendationReason) return;

    const { loggingReason } = recommendationReason;
    if (!loggingReason) return;

    if (loggingReason.startsWith('pin:')) return;
    if (loggingReason.startsWith('search:')) return;
    if (loggingReason === 'orbitznews') return;

    postElement.classList.add(hiddenClass);
  });
};

export const main = async function () {
  onNewPosts.addListener(processPosts);
  document.head.append(styleElement);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  $(`.${hiddenClass}`).removeClass(hiddenClass);
  styleElement.remove();
};
