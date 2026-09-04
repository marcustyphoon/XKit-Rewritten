import { getRandomHexString, sha256 } from '../../utils/crypto.js';
import { filterPostElements } from '../../utils/interface.js';
import { onNewPosts } from '../../utils/mutations.js';
import { getPreferences } from '../../utils/preferences.js';
import { timelineObject } from '../../utils/react_props.js';
import { addSidebarItem, removeSidebarItem } from '../../utils/sidebar.js';
import { tagTimelineFilter } from '../../utils/timeline_id.js';
import { apiFetch, onClickNavigate } from '../../utils/tumblr_helpers.js';

const timestampsStorageKey = 'tag_tracking_plus.trackedTagTimestamps';
/** @type {Record<string, number>} */
let timestamps;

const storedUnreadCountsStorageKey = '_caches.tag_tracking_plus.storedUnreadCounts';
/** @type {Record<string, { unreadCountString: string, updated: number, loaded: boolean }>} */
let storedUnreadCounts;

const excludeClass = 'xkit-tag-tracking-plus-done';
const includeFiltered = true;

let trackedTags = [];

let sidebarItem;

const intervals = {
  BACKGROUND: 10_000, // Minimum time between background refresh fetches.
  LOAD: 500, // Minimum time between initial load fetches (after feature enable/hard refresh/hard nav).
};
const ttls = {
  BACKGROUND: 120_000, // Minimum time between background refresh fetches of a specific tag.
  LOAD: 30_000, // Allow using stored counts up to this old instead of fetching during initial load.
};

const storedCountIsFresh = (tag, ttl) => storedUnreadCounts[tag] && Date.now() - storedUnreadCounts[tag].updated <= ttl;

// If multiple browser tabs are currently refreshing the same set of tracked tag(s), only one may refresh.
let trackedTagsSha;
let lastRefreshInAnotherTab = 0;
const otherTabRefreshChannel = new BroadcastChannel('xkit-tag-tracking-plus-refresh-sync');
otherTabRefreshChannel.addEventListener('message', event => {
  if (trackedTagsSha && event.data === trackedTagsSha) {
    lastRefreshInAnotherTab = Date.now();
  }
});
const shouldRefresh = interval => {
  const timeSinceRefresh = Date.now() - lastRefreshInAnotherTab;
  if (timeSinceRefresh < interval * 1.5) {
    console.info(`Tag Tracking+: skipping refresh; another tab refreshed ${timeSinceRefresh}ms ago`);
    return false;
  }
  otherTabRefreshChannel.postMessage(trackedTagsSha);
  return true;
};

const refreshCount = async function (tag) {
  if (!trackedTags.includes(tag)) return;

  console.info(`Tag Tracking+: REFRESHING ${tag}`);

  let unreadCountString = '⚠️';

  try {
    const savedTimestamp = timestamps[tag] ?? 0;
    const {
      response: {
        timeline: {
          elements = [],
          links,
        },
      },
    } = await apiFetch(
      `/v2/hubs/${encodeURIComponent(tag)}/timeline`,
      { queryParams: { limit: 20, sort: 'recent' } },
    );

    const posts = elements.filter(({ objectType, displayType, recommendedSource }) =>
      objectType === 'post' &&
      displayType === undefined &&
      recommendedSource === null,
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
    unreadCountString = `${unreadCount}${showPlus ? '+' : ''}`;
  } catch (exception) {
    console.error(exception);
  }

  storedUnreadCounts[tag] = { unreadCountString, updated: Date.now(), loaded: true };
  await browser.storage.local.set({ [storedUnreadCountsStorageKey]: storedUnreadCounts });
};

const updateSidebar = () => {
  const data = trackedTags.map(tag => ({ tag, ...storedUnreadCounts[tag] ?? {} }));

  for (const { tag, unreadCountString } of data.filter(({ loaded }) => loaded)) {
    const unreadCountElement = sidebarItem.querySelector(`[data-count-for="#${tag}"]`);
    unreadCountElement.textContent = unreadCountString;
    if (unreadCountElement.closest('li')) {
      unreadCountElement.closest('li').dataset.new = unreadCountString !== '0';
    }
  }
  sidebarItem.dataset.loading = data.some(
    ({ loaded }) => !loaded,
  );
  sidebarItem.dataset.hasNew = data.some(
    ({ loaded, unreadCountString }) => loaded && unreadCountString !== '0',
  );
};

const refreshNext = async () => {
  const nonLoadedTag = trackedTags.find(tag => !storedUnreadCounts[tag]?.loaded);
  const erroredTag = trackedTags.find(tag => storedUnreadCounts[tag]?.unreadCountString === '⚠️');

  if (nonLoadedTag) {
    if (storedCountIsFresh(nonLoadedTag, ttls.LOAD)) {
      console.info(`Tag Tracking+: loading ${nonLoadedTag} from storage!`);
      storedUnreadCounts[nonLoadedTag].loaded = true;
      await browser.storage.local.set({ [storedUnreadCountsStorageKey]: storedUnreadCounts });
    } else {
      await refreshCount(nonLoadedTag);
    }
  } else if (erroredTag) {
    await refreshCount(erroredTag);
  } else {
    const oldestTag = [...trackedTags]
      .sort((a, b) => storedUnreadCounts[a].updated - storedUnreadCounts[b].updated)
      .at(0);

    if (storedCountIsFresh(oldestTag, ttls.BACKGROUND)) {
      console.info(`Tag Tracking+: skipping refresh; oldest tag ${oldestTag} is fresh!`);
    } else {
      await refreshCount(oldestTag);
    }
  }
};

let currentRefreshLoop;
const startRefreshLoop = async () => {
  trackedTagsSha = await sha256(JSON.stringify(trackedTags));

  trackedTags.forEach(tag => {
    if (storedUnreadCounts[tag]) {
      storedUnreadCounts[tag].loaded = false;
    }
  });
  await browser.storage.local.set({ [storedUnreadCountsStorageKey]: storedUnreadCounts });

  const refreshLoopId = getRandomHexString();
  currentRefreshLoop = refreshLoopId;
  // eslint-disable-next-line no-unmodified-loop-condition
  while (currentRefreshLoop === refreshLoopId) {
    const interval = trackedTags.every(tag => storedUnreadCounts[tag]?.loaded)
      ? intervals.BACKGROUND
      : intervals.LOAD;

    await Promise.all([
      shouldRefresh(interval) && refreshNext(),
      new Promise(resolve => setTimeout(resolve, interval)),
    ]);
  }
};
const stopRefreshLoop = () => { currentRefreshLoop = undefined; };

const processPosts = async function (postElements) {
  const { pathname, searchParams } = new URL(location);
  if (!pathname.startsWith('/tagged/') || searchParams.get('sort') === 'top') {
    return;
  }

  const encodedCurrentTag = pathname.split('/')[2];
  const currentTag = decodeURIComponent(encodedCurrentTag);
  if (!trackedTags.includes(currentTag)) return;

  const timeline = tagTimelineFilter(currentTag);

  let updated = false;

  for (const postElement of filterPostElements(postElements, { excludeClass, timeline, includeFiltered })) {
    // see https://github.com/AprilSylph/XKit-Rewritten/issues/1666
    if (!postElement.isConnected) continue;

    const { tags, timestamp } = await timelineObject(postElement);

    if (tags.every(tag => tag.toLowerCase() !== currentTag.toLowerCase())) {
      continue;
    }

    const savedTimestamp = timestamps[currentTag] || 0;
    if (timestamp > savedTimestamp) {
      timestamps[currentTag] = timestamp;
      updated = true;
    }
  }

  if (updated) {
    await browser.storage.local.set({ [timestampsStorageKey]: timestamps });
    refreshCount(currentTag);
  }
};

export const onStorageChanged = async (changes) => {
  const {
    [timestampsStorageKey]: timestampsChanges,
    [storedUnreadCountsStorageKey]: storedUnreadCountsChanges,
    'tag_tracking_plus.preferences.onlyShowNew': onlyShowNewChanges,
  } = changes;

  if (timestampsChanges) {
    timestamps = timestampsChanges.newValue;
  }
  if (storedUnreadCountsChanges) {
    storedUnreadCounts = storedUnreadCountsChanges.newValue;
    updateSidebar();
  }
  if (onlyShowNewChanges) {
    sidebarItem.dataset.onlyShowNew = onlyShowNewChanges.newValue;
  }
};

export const main = async function () {
  const trackedTagsData = (await apiFetch('/v2/user/tags')) ?? {};
  trackedTags = trackedTagsData.response?.tags?.map(({ name }) => name) ?? [];

  const { onlyShowNew } = await getPreferences('tag_tracking_plus');

  sidebarItem = addSidebarItem({
    id: 'tag-tracking-plus',
    title: 'Tag Tracking+',
    rows: trackedTags.map(tag => ({
      label: `#${tag}`,
      href: `/tagged/${encodeURIComponent(tag)}?sort=recent`,
      onclick: onClickNavigate,
      count: '\u22EF',
    })),
  });
  sidebarItem.dataset.onlyShowNew = onlyShowNew;

  if (!trackedTags.length) return;

  ({
    [timestampsStorageKey]: timestamps = {},
    [storedUnreadCountsStorageKey]: storedUnreadCounts = {},
  } = await browser.storage.local.get([timestampsStorageKey, storedUnreadCountsStorageKey]));

  onNewPosts.addListener(processPosts);
  startRefreshLoop();
};

export const clean = async function () {
  stopRefreshLoop();
  onNewPosts.removeListener(processPosts);

  removeSidebarItem('tag-tracking-plus');

  trackedTags = [];

  trackedTagsSha = undefined;
  lastRefreshInAnotherTab = 0;
};

export const stylesheet = true;
