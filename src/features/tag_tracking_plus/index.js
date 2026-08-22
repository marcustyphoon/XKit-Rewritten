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

const FIRST_RUN_REFRESH_INTERVAL = 500; // Load tags up to this quickly after feature enable/hard navigate/f5.
const REFRESH_INTERVAL = 10 * 1000; // Refresh tags up to this quickly in the background.
const PER_TAG_REFRESH_TTL = 2 * 60 * 1000; // Only background-refresh each tag up to this often.

const STORED_COUNT_TTL = 30 * 1000; // Allow stored counts up to this old to be substituted for API fetches.

const storedCountIsFresh = (tag, ttl) => storedUnreadCounts[tag] &&
  Date.now() - storedUnreadCounts[tag].updated <= ttl;

// If multiple browser tabs are currently refreshing the same tracked tag(s), only let the first refresh.
let lastRefreshInAnotherTab = -Infinity;
const thisTabShouldRefresh = (interval) => {
  if (Date.now() - lastRefreshInAnotherTab < interval * 1.5) {
    console.log(`Tag Tracking+: skipping refresh; another tab refreshed ${Date.now() - lastRefreshInAnotherTab}ms ago`);
    return false;
  }
  return true;
};
const tabRefreshSyncChannel = new BroadcastChannel('xkit-tag-tracking-plus-refresh-sync');
tabRefreshSyncChannel.addEventListener('message', ({ data: { trackedTags: otherTabTrackedTags } }) => {
  if (trackedTags.every(tag => otherTabTrackedTags.includes(tag))) {
    lastRefreshInAnotherTab = Date.now();
  }
});

const refreshCount = async function (tag) {
  if (!trackedTags.includes(tag)) return;
  tabRefreshSyncChannel.postMessage({ trackedTags });
  console.log(`Tag Tracking+: REFRESHING ${tag}`);

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

  if (unreadCountString !== '⚠️') {
    storedUnreadCounts[tag] = { unreadCountString, updated: Date.now() };
    await browser.storage.local.set({ [storedUnreadCountsStorageKey]: storedUnreadCounts });
  }

  unreadCounts.set(tag, unreadCountString);
  updateSidebar();
};

const loadCountFromStorage = async function (tag) {
  console.log(`Tag Tracking+: loading stored initial count for ${tag}.`);
  unreadCounts.set(tag, storedUnreadCounts[tag].unreadCountString);
  updateSidebar();
};

const updateSidebar = () => {
  if (sidebarItem) {
    for (const [tag, unreadCountString] of unreadCounts) {
      const unreadCountElement = sidebarItem.querySelector(`[data-count-for="#${tag}"]`);
      unreadCountElement.textContent = unreadCountString;
      if (unreadCountElement.closest('li')) {
        unreadCountElement.closest('li').dataset.new = unreadCountString !== '0';
      }
    }
    sidebarItem.dataset.loading = [...unreadCounts.values()].some(
      unreadCountString => unreadCountString === undefined,
    );
    sidebarItem.dataset.hasNew = [...unreadCounts.values()].some(
      unreadCountString => unreadCountString && unreadCountString !== '0',
    );
  }
};

const loadInitialCounts = async () => {
  while (!trackedTags.every(tag => unreadCounts.has(tag))) {
    const nextTag = trackedTags.find(tag => !unreadCounts.has(tag));

    await Promise.all([
      storedCountIsFresh(nextTag, STORED_COUNT_TTL)
        ? loadCountFromStorage(nextTag)
        : thisTabShouldRefresh(FIRST_RUN_REFRESH_INTERVAL) && refreshCount(nextTag),
      new Promise(resolve => setTimeout(resolve, FIRST_RUN_REFRESH_INTERVAL)),
    ]);
  }
};

let intervalID = 0;
const startRefreshInterval = () => {
  intervalID = setInterval(() => {
    const erroredTag = trackedTags.find(tag => unreadCounts.get(tag) === '⚠️');
    if (erroredTag) {
      refreshCount(erroredTag);
      return;
    }
    if (thisTabShouldRefresh(REFRESH_INTERVAL)) {
      const oldestTag = [...trackedTags]
        .sort((a, b) => storedUnreadCounts[a].updated - storedUnreadCounts[b].updated)
        .at(0);
      if (storedCountIsFresh(oldestTag, PER_TAG_REFRESH_TTL) === false) {
        refreshCount(oldestTag);
      } else {
        console.log(`Tag Tracking+: refresh fired, but oldest tag (${oldestTag}) is not older than PER_TAG_REFRESH_TTL ${PER_TAG_REFRESH_TTL}.`);
      }
    }
  }, REFRESH_INTERVAL);
};
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
    for (const [tag] of unreadCounts) {
      if (storedCountIsFresh(tag, STORED_COUNT_TTL)) {
        unreadCounts.set(tag, storedUnreadCounts[tag].unreadCountString);
      }
    }
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

  sidebarItem.dataset.onlyShowNew = onlyShowNew;
  sidebarItem.dataset.loading = true;

  onNewPosts.addListener(processPosts);
  loadInitialCounts().then(startRefreshInterval);
};

export const clean = async function () {
  stopRefreshInterval();
  onNewPosts.removeListener(processPosts);

  removeSidebarItem('tag-tracking-plus');

  trackedTags = [];
  lastRefreshInAnotherTab = -Infinity;
  unreadCounts.clear();
};

export const stylesheet = true;
