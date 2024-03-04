import { apiFetch, onClickNavigate } from '../util/tumblr_helpers.js';
import { filterPostElements } from '../util/interface.js';
import { timelineObject } from '../util/react_props.js';
import { onNewPosts } from '../util/mutations.js';
import { addSidebarItem, removeSidebarItem } from '../util/sidebar.js';
import { getPreferences } from '../util/preferences.js';

const storageKey = 'search_tracking_plus.trackedSearchTimestamps';
let timestamps;

const timelineRegex = /\/v2\/timeline\/search/;
const excludeClass = 'xkit-search-tracking-plus-done';
const includeFiltered = true;

let searches;
const unreadCounts = new Map();

let sidebarItem;

const refreshCount = async function (search) {
  if (!searches.includes(search)) return;

  let unreadCountString = '⚠️';

  try {
    const savedTimestamp = timestamps[search] ?? 0;
    const {
      response: {
        psa,
        timeline: { elements = [], links }
      }
    } = await apiFetch('/v2/timeline/search', {
      queryParams: {
        query: search,
        limit: 20,
        mode: 'recent',
        timeline_type: 'post',
        skip_component: 'related_tags,blog_search'
      }
    });

    const posts = elements.filter(({ objectType, displayType, recommendedSource }) =>
      objectType === 'post' &&
      displayType === undefined &&
      recommendedSource === null
    );

    let unreadCount = 0;

    for (const { timestamp } of posts) {
      if (timestamp <= savedTimestamp) {
        break;
      } else {
        unreadCount++;
      }
    }

    const showPlus = unreadCount === posts.length && links?.next;
    unreadCountString = psa ? 0 : `${unreadCount}${showPlus ? '+' : ''}`;
  } catch (exception) {
    console.error(exception);
  }

  [document, ...(!sidebarItem || document.contains(sidebarItem) ? [] : [sidebarItem])]
    .flatMap(node =>
      [...node.querySelectorAll('[data-count-for]')].filter(
        ({ dataset: { countFor } }) => countFor === search
      )
    )
    .filter((value, index, array) => array.indexOf(value) === index)
    .forEach(unreadCountElement => {
      unreadCountElement.textContent = unreadCountString;
      if (unreadCountElement.closest('li')) {
        unreadCountElement.closest('li').dataset.new = unreadCountString !== '0';
      }
    });

  unreadCounts.set(search, unreadCountString);
  updateSidebarStatus();
};

const updateSidebarStatus = () => {
  if (sidebarItem) {
    sidebarItem.dataset.loading = [...unreadCounts.values()].some(
      unreadCountString => unreadCountString === undefined
    );
    sidebarItem.dataset.hasNew = [...unreadCounts.values()].some(
      unreadCountString => unreadCountString && unreadCountString !== '0'
    );
  }
};

const refreshAllCounts = async (isFirstRun = false) => {
  for (const search of searches) {
    await Promise.all([
      refreshCount(search),
      new Promise(resolve => setTimeout(resolve, isFirstRun ? 0 : 30000))
    ]);
  }
};

let intervalID = 0;
const startRefreshInterval = () => { intervalID = setInterval(refreshAllCounts, 30000 * searches.length); };
const stopRefreshInterval = () => clearInterval(intervalID);

const processPosts = async function (postElements) {
  const { pathname } = new URL(location);
  if (!pathname.startsWith('/search/') || !pathname.endsWith('/recent')) {
    return;
  }

  const encodedCurrentSearch = pathname.split('/')[2];
  const currentSearch = decodeURIComponent(encodedCurrentSearch);
  if (!searches.includes(currentSearch)) return;

  let updated = false;

  for (const postElement of filterPostElements(postElements, { excludeClass, timelineRegex, includeFiltered })) {
    const { timestamp } = await timelineObject(postElement);

    const savedTimestamp = timestamps[currentSearch] || 0;
    if (timestamp > savedTimestamp) {
      timestamps[currentSearch] = timestamp;
      updated = true;
    }
  }

  if (updated) {
    await browser.storage.local.set({ [storageKey]: timestamps });
    refreshCount(currentSearch);
  }
};

export const onStorageChanged = async (changes, areaName) => {
  if (Object.keys(changes).includes(storageKey)) {
    timestamps = changes[storageKey].newValue;
  }
  if (Object.keys(changes).some(key => key.startsWith('search_tracking_plus.preferences'))) {
    const { onlyShowNew } = await getPreferences('search_tracking_plus');

    sidebarItem.dataset.onlyShowNew = onlyShowNew;
  }
};

export const main = async function () {
  const { trackedSearches, onlyShowNew } = await getPreferences('search_tracking_plus');
  searches = trackedSearches.split(',').map(username => username.trim()).filter(Boolean);

  searches.forEach(search => unreadCounts.set(search, undefined));

  ({ [storageKey]: timestamps = {} } = await browser.storage.local.get(storageKey));

  sidebarItem = addSidebarItem({
    id: 'search-tracking-plus',
    title: 'Search Tracking+',
    rows: searches.map(search => ({
      label: `${search}`,
      href: `/search/${encodeURIComponent(search)}/recent`,
      onclick: onClickNavigate,
      count: '\u22EF'
    }))
  });
  sidebarItem.dataset.onlyShowNew = onlyShowNew;
  updateSidebarStatus();

  onNewPosts.addListener(processPosts);
  refreshAllCounts(true).then(startRefreshInterval);
};

export const clean = async function () {
  stopRefreshInterval();
  onNewPosts.removeListener(processPosts);

  removeSidebarItem('search-tracking-plus');

  unreadCounts.clear();
  sidebarItem = undefined;
};

export const stylesheet = true;