import { filterPostElements } from '../../utils/interface.js';
import { onNewPosts } from '../../utils/mutations.js';
import { getPreferences } from '../../utils/preferences.js';
import { timelineObject } from '../../utils/react_props.js';
import { addSidebarItem, removeSidebarItem } from '../../utils/sidebar.js';
import { tagTimelineFilter } from '../../utils/timeline_id.js';
import { apiFetch, onClickNavigate } from '../../utils/tumblr_helpers.js';

const timestampsStorageKey = 'tag_tracking_plus.trackedTagTimestamps';
let timestamps;
const unreadCountsStorageKey = 'tag_tracking_plus.unreadCounts';
let unreadCounts;

const excludeClass = 'xkit-tag-tracking-plus-done';
const includeFiltered = true;

let trackedTags;

let sidebarItem;

const REFRESH_INTERVAL = 10000;
const FIRST_RUN_REFRESH_INTERVAL = 500;
const UNREAD_COUNT_TTL = 20000;

const tagCountIsFresh = tag =>
  unreadCounts[tag] && Date.now() - unreadCounts[tag].updated <= UNREAD_COUNT_TTL;

let otherTabRefreshChannel;
let lastRefreshInOtherTab = 0;
const onOtherTabRefresh = ({ data: tag }) => {
  if (trackedTags.includes(tag)) {
    lastRefreshInOtherTab = Date.now();
  }
};

const refreshOldestCount = async function (isFirstRun = false) {
  const oldestTag =
    trackedTags.find(tag => !unreadCounts[tag]) ||
    trackedTags.find(tag => unreadCounts[tag].unreadCountString === '⚠️') ||
    [...trackedTags].sort((a, b) => unreadCounts[a].updated - unreadCounts[b].updated).at(0);

  if (
    Date.now() - lastRefreshInOtherTab <
    1.5 * (isFirstRun ? FIRST_RUN_REFRESH_INTERVAL : REFRESH_INTERVAL)
  ) {
    console.log(`Tag Tracking+: skipping refresh; another tab refreshed ${Date.now() - lastRefreshInOtherTab}ms ago`);
    return;
  }
  await refreshCount(oldestTag);
};

const refreshCount = async function (tag) {
  console.log(`Tag Tracking+: REFRESHING ${tag}`);
  otherTabRefreshChannel.postMessage(tag);

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
  await browser.storage.local.set({ [unreadCountsStorageKey]: unreadCounts });
};

const updateSidebar = () => {
  const data = trackedTags
    .filter(tagCountIsFresh)
    .map(tag => ({ tag, unreadCountString: unreadCounts[tag].unreadCountString }));

  data.forEach(({ tag, unreadCountString }) => {
    const unreadCountElement = sidebarItem.querySelector(`[data-count-for="#${tag}"]`);
    unreadCountElement.textContent = unreadCountString;
    if (unreadCountElement.closest('li')) {
      unreadCountElement.closest('li').dataset.new = unreadCountString !== '0';
    }
  });
  sidebarItem.dataset.hasNew = data.some(({ unreadCountString }) => unreadCountString !== '0');
};

const loadInitialCounts = async () => {
  while (!trackedTags.every(tagCountIsFresh)) {
    await Promise.all([
      refreshOldestCount(true),
      new Promise(resolve => setTimeout(resolve, FIRST_RUN_REFRESH_INTERVAL)),
    ]);
  }
  sidebarItem.dataset.loading = false;
};

let intervalID = 0;
const startRefreshInterval = () => { intervalID = setInterval(refreshOldestCount, REFRESH_INTERVAL); };
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
    [unreadCountsStorageKey]: countsChanges,
    'tag_tracking_plus.preferences.onlyShowNew': onlyShowNewChanges,
  } = changes;

  if (timestampsChanges) {
    timestamps = timestampsChanges.newValue;
  }
  if (countsChanges) {
    unreadCounts = countsChanges.newValue;
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
      count: '\u22EF',
    })),
  });
  if (!trackedTags.length) return;

  sidebarItem.dataset.loading = true;
  sidebarItem.dataset.onlyShowNew = onlyShowNew;
  updateSidebar();

  otherTabRefreshChannel = new BroadcastChannel('xkit-tag-tracking-plus-refresh-sync');
  otherTabRefreshChannel.addEventListener('message', onOtherTabRefresh);

  onNewPosts.addListener(processPosts);
  loadInitialCounts().then(startRefreshInterval);
};

export const clean = async function () {
  stopRefreshInterval();
  onNewPosts.removeListener(processPosts);

  removeSidebarItem('tag-tracking-plus');

  otherTabRefreshChannel?.close();
};

export const stylesheet = true;
