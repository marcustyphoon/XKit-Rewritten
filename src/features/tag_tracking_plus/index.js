import { apiFetch, onClickNavigate } from '../../utils/tumblr_helpers.js';
import { filterPostElements } from '../../utils/interface.js';
import { timelineObject } from '../../utils/react_props.js';
import { onNewPosts } from '../../utils/mutations.js';
import { addSidebarItem, removeSidebarItem } from '../../utils/sidebar.js';
import { getPreferences } from '../../utils/preferences.js';
import { tagTimelineFilter } from '../../utils/timeline_id.js';

const excludeClass = 'xkit-tag-tracking-plus-done';
const includeFiltered = true;

const timestampsStorageKey = 'tag_tracking_plus.trackedTagTimestamps';
const unreadCountsStorageKey = 'tag_tracking_plus.unreadCounts';
const lastRefreshesStorageKey = 'tag_tracking_plus.storedLastRefreshes';

let timestamps;
let unreadCounts;

let trackedTags;
let isLoaded = {};
let lastRefreshes = {};

let sidebarItem;

const refreshCount = async function (tag, force = false) {
  if (!trackedTags.includes(tag)) return;

  const { [lastRefreshesStorageKey]: storedLastRefreshes = {} } = await browser.storage.local.get(lastRefreshesStorageKey);
  const storedLastRefresh = storedLastRefreshes[tag] ?? 0;
  const lastRefresh = lastRefreshes[tag] ?? Infinity;

  const anotherTabRefreshedThisTag = storedLastRefresh > lastRefresh;

  const now = Date.now();
  lastRefreshes[tag] = now;

  if (anotherTabRefreshedThisTag && !force) {
    // another tab did a fetch while we were waiting; let it be the one in charge of updating this tag.
    console.log('Tag Tracking+: SKIPPING ', tag);
    return;
  }

  // this tab is now in charge of updating this tag.
  storedLastRefreshes[tag] = now;
  await browser.storage.local.set({ [lastRefreshesStorageKey]: storedLastRefreshes });
  console.log('Tag Tracking+: REFRESHING ', tag);

  let unreadCountString = '⚠️';

  try {
    const savedTimestamp = timestamps[tag] ?? 0;
    const {
      response: {
        timeline: {
          elements = [],
          links
        }
      }
    } = await apiFetch(
      `/v2/hubs/${encodeURIComponent(tag)}/timeline`,
      { queryParams: { limit: 20, sort: 'recent' } }
    );

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
    unreadCountString = `${unreadCount}${showPlus ? '+' : ''}`;
  } catch (exception) {
    console.error(exception);
  }

  isLoaded[tag] = true;
  unreadCounts[tag] = unreadCountString;
  await browser.storage.local.set({ [unreadCountsStorageKey]: unreadCounts });
};

const updateSidebarStatus = () => {
  if (sidebarItem) {
    sidebarItem.dataset.loading = !trackedTags.every(tag => isLoaded[tag]);
    sidebarItem.dataset.hasNew = trackedTags.some(
      tag => unreadCounts[tag] && unreadCounts[tag] !== '0'
    );
  }
};

const refreshAllCounts = async (isFirstRun = false) => {
  for (const tag of trackedTags) {
    await Promise.all([
      refreshCount(tag, isFirstRun),
      new Promise(resolve => setTimeout(resolve, isFirstRun ? 0 : 3000))
    ]);
  }
};

let intervalID = 0;
const startRefreshInterval = () => { intervalID = setInterval(refreshAllCounts, 3000 * trackedTags.length); refreshAllCounts(); };
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
    refreshCount(currentTag, true);
  }
};

export const onStorageChanged = async (changes) => {
  const {
    [timestampsStorageKey]: timestampsChanges,
    [unreadCountsStorageKey]: unreadCountsChanges,
    'tag_tracking_plus.preferences.onlyShowNew': onlyShowNewChanges
  } = changes;

  if (timestampsChanges) {
    timestamps = timestampsChanges.newValue;
  }
  if (onlyShowNewChanges) {
    sidebarItem.dataset.onlyShowNew = onlyShowNewChanges.newValue;
  }

  if (unreadCountsChanges) {
    unreadCounts = unreadCountsChanges.newValue;

    Object.entries(unreadCounts).forEach(([tag, unreadCountString]) => {
      const unreadCountElement = sidebarItem.querySelector(`[data-count-for="#${tag}"]`);

      unreadCountElement.textContent = unreadCountString;
      if (unreadCountElement.closest('li')) {
        unreadCountElement.closest('li').dataset.new = unreadCountString !== '0';
      }
    });
    updateSidebarStatus();
  }
};

export const main = async function () {
  const trackedTagsData = (await apiFetch('/v2/user/tags')) ?? {};
  trackedTags = trackedTagsData.response?.tags?.map(({ name }) => name) ?? [];

  if (trackedTags.length === 0) return;

  ({
    [timestampsStorageKey]: timestamps = {},
    [unreadCountsStorageKey]: unreadCounts = {},
  } = await browser.storage.local.get([timestampsStorageKey, unreadCountsStorageKey]));

  const { onlyShowNew } = await getPreferences('tag_tracking_plus');

  sidebarItem = addSidebarItem({
    id: 'tag-tracking-plus',
    title: 'Tag Tracking+',
    rows: trackedTags.map(tag => ({
      label: `#${tag}`,
      href: `/tagged/${encodeURIComponent(tag)}?sort=recent`,
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

  removeSidebarItem('tag-tracking-plus');

  lastRefreshes = {};
  isLoaded = {};
};

export const stylesheet = true;
