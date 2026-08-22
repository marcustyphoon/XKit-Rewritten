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

const storedUnreadCountsStorageKey = 'tag_tracking_plus.storedUnreadCounts';
/** @type {Record<string, { unreadCountString: string, updated: number }>} */
let storedUnreadCounts;

const excludeClass = 'xkit-tag-tracking-plus-done';
const includeFiltered = true;

let trackedTags = [];
const unreadCounts = new Map();

let sidebarItem;

const FIRST_RUN_REFRESH_INTERVAL = 500; // Load tags this quickly after feature enable/hard navigate/f5.
const BACKGROUND_REFRESH_INTERVAL = 10 * 1000; // Refresh tags this quickly in the background.
const BACKGROUND_PER_TAG_REFRESH_TTL = 2 * 60 * 1000; // Only background-refresh each tag up to  this often.

// Use stored count entries (from other tabs, or from a very recent hard navigate/f5) if they're this fresh.
const STORED_COUNT_TTL = 30 * 1000;

const storedTagCountIsFresh = (tag, ttl) =>
  storedUnreadCounts[tag] && Date.now() - storedUnreadCounts[tag].updated <= ttl;

const updateUnreadCountsFromStored = () =>
  trackedTags.forEach(tag =>
    storedTagCountIsFresh(tag, STORED_COUNT_TTL) &&
    unreadCounts.set(tag, storedUnreadCounts[tag].unreadCountString),
  );

let lastRefreshInAnotherTab = -Infinity;
const tabRefreshSyncChannel = new BroadcastChannel('xkit-tag-tracking-plus-refresh-sync');
tabRefreshSyncChannel.addEventListener('message', ({ data: { tag } }) => {
  if (trackedTags.includes(tag)) {
    lastRefreshInAnotherTab = Date.now();
  }
});

const refreshCount = async function (tag, interval) {
  if (interval && (Date.now() - lastRefreshInAnotherTab < interval * 1.5)) {
    // Another browser tab is currently refreshing the same tracked tag(s); skip refreshing.
    console.log(`Tag Tracking+: skipping refresh; another tab refreshed ${Date.now() - lastRefreshInAnotherTab}ms ago`);
    return;
  }

  console.log(`Tag Tracking+: REFRESHING ${tag}`);
  tabRefreshSyncChannel.postMessage({ tag });

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

  unreadCounts.set(tag, unreadCountString);
  updateSidebar();

  if (unreadCountString !== '⚠️') {
    storedUnreadCounts[tag] = { unreadCountString, updated: Date.now() };
    await browser.storage.local.set({ [storedUnreadCountsStorageKey]: storedUnreadCounts });
  }
};

const updateSidebar = () => {
  for (const [tag, unreadCountString] of unreadCounts) {
    const unreadCountElement = sidebarItem.querySelector(`[data-count-for="#${tag}"]`);
    unreadCountElement.textContent = unreadCountString;
    if (unreadCountElement.closest('li')) {
      unreadCountElement.closest('li').dataset.new = unreadCountString !== '0';
    }
  }
  sidebarItem.dataset.hasNew = [...unreadCounts.values()].some(
    unreadCountString => unreadCountString && unreadCountString !== '0',
  );
};

const loadInitialCounts = async () => {
  while (!trackedTags.every(tag => unreadCounts.has(tag))) {
    await Promise.all([
      refreshCount(trackedTags.find(tag => !unreadCounts.has(tag)), FIRST_RUN_REFRESH_INTERVAL),
      new Promise(resolve => setTimeout(resolve, FIRST_RUN_REFRESH_INTERVAL)),
    ]);
  }
  sidebarItem.dataset.loading = false;
};

const refreshNextCount = () => {
  const erroredTag = trackedTags.find(tag => unreadCounts.get(tag) === '⚠️');
  if (erroredTag) {
    refreshCount(erroredTag);
  } else {
    const oldestTag = [...trackedTags].sort((a, b) => storedUnreadCounts[a].updated - storedUnreadCounts[b].updated).at(0);

    if (storedTagCountIsFresh(oldestTag, BACKGROUND_PER_TAG_REFRESH_TTL)) {
      console.log(`Tag Tracking+: refresh fired, but no tags are older than REFRESH_TTL ${BACKGROUND_PER_TAG_REFRESH_TTL}.`);
    } else {
      refreshCount(oldestTag, BACKGROUND_REFRESH_INTERVAL);
    }
  }
};

let intervalID = 0;
const startRefreshInterval = () => { intervalID = setInterval(refreshNextCount, BACKGROUND_REFRESH_INTERVAL); };
const stopRefreshInterval = () => clearInterval(intervalID);

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
    updateUnreadCountsFromStored();
    updateSidebar();
  }
  if (onlyShowNewChanges) {
    sidebarItem.dataset.onlyShowNew = onlyShowNewChanges.newValue;
  }
};

export const main = async function () {
  const trackedTagsData = (await apiFetch('/v2/user/tags')) ?? {};
  trackedTags = trackedTagsData.response?.tags?.map(({ name }) => name) ?? [];

  ({
    [timestampsStorageKey]: timestamps = {},
    [storedUnreadCountsStorageKey]: storedUnreadCounts = {},
  } = await browser.storage.local.get([timestampsStorageKey, storedUnreadCountsStorageKey]));

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
  if (!trackedTags.length) return;

  sidebarItem.dataset.loading = true;
  sidebarItem.dataset.onlyShowNew = onlyShowNew;

  updateUnreadCountsFromStored();
  updateSidebar();

  onNewPosts.addListener(processPosts);
  loadInitialCounts().then(startRefreshInterval);
};

export const clean = async function () {
  stopRefreshInterval();
  onNewPosts.removeListener(processPosts);

  removeSidebarItem('tag-tracking-plus');

  trackedTags = [];
  unreadCounts.clear();
};

export const stylesheet = true;
