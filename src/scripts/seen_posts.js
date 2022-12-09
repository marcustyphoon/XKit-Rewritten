import { filterPostElements, postSelector } from '../util/interface.js';
import { getPreferences } from '../util/preferences.js';
import { onNewPosts } from '../util/mutations.js';

const excludeClass = 'xkit-seen-posts-done';
const timeline = /\/v2\/timeline\/dashboard/;
const includeFiltered = true;

const dimClass = 'xkit-seen-posts-seen';
const onlyDimAvatarsClass = 'xkit-seen-posts-only-dim-avatar';

const storageKey = 'seen_posts.seenPosts';
let seenPosts = [];

/** @type {Map<Element, ?number>} */
const timers = new Map();

const observer = new IntersectionObserver(
  (entries) => entries.forEach(({ isIntersecting, target: articleElement }) => {
    if (isIntersecting) {
      if (!timers.has(articleElement)) {
        timers.set(articleElement, setTimeout(() => markAsSeen(articleElement), 300));
      }
    } else {
      clearTimeout(timers.get(articleElement));
      timers.delete(articleElement);
    }
  }),
  { rootMargin: '-20px 0px' }
);

const markAsSeen = (articleElement) => {
  observer.unobserve(articleElement);
  timers.delete(articleElement);

  articleElement.parentElement.style.outline = '4px solid grey';

  const postElement = articleElement.closest(postSelector);
  seenPosts.push(postElement.dataset.id);
  seenPosts.splice(0, seenPosts.length - 10000);
  browser.storage.local.set({ [storageKey]: seenPosts });
};

const dimPosts = function (postElements) {
  for (const postElement of filterPostElements(postElements, { excludeClass, timeline, includeFiltered })) {
    const { id } = postElement.dataset;

    if (seenPosts.includes(id)) {
      postElement.classList.add(dimClass);
    } else {
      observer.observe(postElement.querySelector('article'));
    }
  }
};

export const onStorageChanged = async function (changes, areaName) {
  const {
    'seen_posts.preferences.onlyDimAvatars': onlyDimAvatarsChanges,
    [storageKey]: seenPostsChanges
  } = changes;

  if (onlyDimAvatarsChanges && onlyDimAvatarsChanges.oldValue !== undefined) {
    const { newValue: onlyDimAvatars } = onlyDimAvatarsChanges;
    const addOrRemove = onlyDimAvatars ? 'add' : 'remove';
    document.body.classList[addOrRemove](onlyDimAvatarsClass);
  }

  if (seenPostsChanges) {
    ({ newValue: seenPosts } = seenPostsChanges);
  }
};

export const main = async function () {
  ({ [storageKey]: seenPosts = [] } = await browser.storage.local.get(storageKey));

  const { onlyDimAvatars } = await getPreferences('seen_posts');
  if (onlyDimAvatars) {
    document.body.classList.add(onlyDimAvatarsClass);
  }

  onNewPosts.addListener(dimPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(dimPosts);

  observer.disconnect();
  timers.forEach((timerId) => clearTimeout(timerId));
  timers.clear();

  $(`.${excludeClass}`).removeClass(excludeClass);
  $(`.${dimClass}`).removeClass(dimClass);
  $(`.${onlyDimAvatarsClass}`).removeClass(onlyDimAvatarsClass);
};

export const stylesheet = true;
