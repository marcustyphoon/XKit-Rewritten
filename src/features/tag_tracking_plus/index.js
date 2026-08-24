import { filterPostElements } from '../../utils/interface.js';
import { onNewPosts } from '../../utils/mutations.js';
import { getPreferences } from '../../utils/preferences.js';
import { timelineObject } from '../../utils/react_props.js';
import { addSidebarItem, removeSidebarItem } from '../../utils/sidebar.js';
import { tagTimelineFilter } from '../../utils/timeline_id.js';
import { apiFetch, onClickNavigate } from '../../utils/tumblr_helpers.js';

const sameArrayContents = (a = [], b = []) => a.length === b.length && a.every(value => b.includes(value));

const storageKey = 'tag_tracking_plus.trackedTagTimestamps';
let timestamps;

const excludeClass = 'xkit-tag-tracking-plus-done';
const includeFiltered = true;

let trackedTags;

/** @type {Record<string, {unreadCountString: string, updated: number}>} */
let unreadCounts = {};

let sidebarItem;

const FIRST_RUN_REFRESH_INTERVAL = 500; // Load tags up to this quickly after feature enable/hard navigate/f5.
const REFRESH_INTERVAL = 10 * 1000; // Refresh tags up to this quickly in the background.
const PER_TAG_REFRESH_TTL = 2 * 60 * 1000; // Only background-refresh each tag up to this often.

const STORED_COUNT_TTL = 30 * 1000; // Allow stored counts up to this old to be substituted for API fetches.

const countIsFresh = (count, ttl) => count && Date.now() - count.updated <= ttl;

// If multiple browser tabs are currently refreshing the same tracked tag(s), only let the first refresh.
let lastRefreshAttemptInAnotherTab = -Infinity;
const thisTabShouldRefresh = (interval) => {
  if (Date.now() - lastRefreshAttemptInAnotherTab < interval * 1.5) {
    console.log(`Tag Tracking+: skipping refresh; another tab refreshed ${Date.now() - lastRefreshAttemptInAnotherTab}ms ago`);
    return false;
  }
  return true;
};
const refreshAttemptChannel = new BroadcastChannel('xkit-tag-tracking-plus-refresh-attempt');
refreshAttemptChannel.addEventListener('message', ({ data }) => {
  if (sameArrayContents(trackedTags, data.trackedTags)) {
    lastRefreshAttemptInAnotherTab = Date.now();
  }
});
const refreshSuccessChannel = new BroadcastChannel('xkit-tag-tracking-plus-refresh-success');
refreshSuccessChannel.addEventListener('message', ({ data }) => {
  if (sameArrayContents(trackedTags, data.trackedTags)) {
    for (const [tag, count] of Object.entries(data.unreadCounts)) {
      if (countIsFresh(count, STORED_COUNT_TTL)) {
        unreadCounts[tag] = count;
        updateSidebar(tag);
      }
    }
  }
});

const refreshCount = async function (tag) {
  if (!trackedTags.includes(tag)) return;
  refreshAttemptChannel.postMessage({ trackedTags });
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

  unreadCounts[tag] = { unreadCountString, updated: Date.now() };
  updateSidebar(tag);

  if (unreadCountString !== '⚠️') {
    refreshSuccessChannel.postMessage({ trackedTags, unreadCounts });
  }
};

const updateSidebar = (tag) => {
  const { unreadCountString } = unreadCounts[tag];
  const unreadCountElement = sidebarItem.querySelector(`[data-count-for="#${tag}"]`);

  unreadCountElement.textContent = unreadCountString;
  if (unreadCountElement.closest('li')) {
    unreadCountElement.closest('li').dataset.new = unreadCountString !== '0';
  }

  const allTrackedCounts = trackedTags.map(tag => unreadCounts[tag]?.unreadCountString);
  sidebarItem.dataset.loading = allTrackedCounts.some(count => count === undefined);
  sidebarItem.dataset.hasNew = allTrackedCounts.some(count => count && count !== '0');
};

const loadInitialCounts = async () => {
  while (!trackedTags.every(tag => unreadCounts[tag])) {
    await Promise.all([
      thisTabShouldRefresh(FIRST_RUN_REFRESH_INTERVAL) &&
        refreshCount(trackedTags.find(tag => !unreadCounts[tag])),
      new Promise(resolve => setTimeout(resolve, FIRST_RUN_REFRESH_INTERVAL)),
    ]);
  }
};

let intervalID = 0;
const startRefreshInterval = () => {
  intervalID = setInterval(() => {
    const erroredTag = trackedTags.find(tag => unreadCounts[tag]?.unreadCountString === '⚠️');
    if (erroredTag) {
      refreshCount(erroredTag);
      return;
    }
    if (thisTabShouldRefresh(REFRESH_INTERVAL)) {
      const oldestTag = [...trackedTags]
        .sort((a, b) => unreadCounts[a].updated - unreadCounts[b].updated)
        .at(0);
      if (countIsFresh(unreadCounts[oldestTag], PER_TAG_REFRESH_TTL) === false) {
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
    await browser.storage.local.set({ [storageKey]: timestamps });
    refreshCount(currentTag);
  }
};

export const onStorageChanged = async (changes) => {
  const {
    [storageKey]: timestampsChanges,
    'tag_tracking_plus.preferences.onlyShowNew': onlyShowNewChanges,
  } = changes;

  if (timestampsChanges) {
    timestamps = timestampsChanges.newValue;
  }
  if (onlyShowNewChanges) {
    sidebarItem.dataset.onlyShowNew = onlyShowNewChanges.newValue;
  }
};

export const main = async function () {
  const trackedTagsData = (await apiFetch('/v2/user/tags')) ?? {};
  trackedTags = trackedTagsData.response?.tags?.map(({ name }) => name) ?? [];

  ({ [storageKey]: timestamps = {} } = await browser.storage.local.get(storageKey));

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
  lastRefreshAttemptInAnotherTab = -Infinity;
  unreadCounts = {};
};

export const stylesheet = true;
