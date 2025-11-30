import { apiFetch, onClickNavigate } from '../../utils/tumblr_helpers.js';
import { filterPostElements } from '../../utils/interface.js';
import { timelineObject } from '../../utils/react_props.js';
import { onNewPosts } from '../../utils/mutations.js';
import { addSidebarItem, removeSidebarItem } from '../../utils/sidebar.js';
import { getPreferences } from '../../utils/preferences.js';
import { searchTimelineFilter } from '../../utils/timeline_id.js';

const storageKey = 'search_tracking_plus.trackedSearchTimestamps';
let timestamps;

const excludeClass = 'xkit-tag-tracking-plus-done';
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

  const unreadCountElement = sidebarItem.querySelector(`[data-count-for="${search}"]`);

  unreadCountElement.textContent = unreadCountString;
  if (unreadCountElement.closest('li')) {
    unreadCountElement.closest('li').dataset.new = unreadCountString !== '0';
  }

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

  const timeline = searchTimelineFilter(currentSearch);

  let updated = false;

  for (const postElement of filterPostElements(postElements, { excludeClass, timeline, includeFiltered })) {
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
  const {
    'search_tracking_plus.preferences.trackedSearches': trackedSearchesChanges,
    'search_tracking_plus.preferences.onlyShowNew': onlyShowNewChanges,
    [storageKey]: timestampsChanges
  } = changes;

  if (trackedSearchesChanges) {
    clean().then(main);
    return;
  }

  if (timestampsChanges) {
    timestamps = timestampsChanges.newValue;
  }
  if (onlyShowNewChanges) {
    sidebarItem.dataset.onlyShowNew = onlyShowNewChanges.newValue;
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
