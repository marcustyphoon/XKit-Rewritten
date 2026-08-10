import { debounce } from '../../utils/debounce.js';
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
const UNREAD_COUNT_TTL = 20000;
let otherTabRefreshChannel;
let initialLoadTags;

const refreshCount = async function (tag) {
  if (!trackedTags.includes(tag)) return;

  otherTabRefreshChannel.postMessage(tag);
  initialLoadTags = initialLoadTags.filter(initialLoadTag => initialLoadTag !== tag);
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
  await browser.storage.local.set({ [unreadCountsStorageKey]: unreadCounts });
};

const renderRefreshedCounts = () => {
  if (sidebarItem) {
    let hasNew = false;
    const now = Date.now();
    for (const tag of trackedTags) {
      if (unreadCounts[tag] && now - unreadCounts[tag].updated <= UNREAD_COUNT_TTL) {
        const { unreadCountString } = unreadCounts[tag];
        const isNew = unreadCountString !== '0';

        const unreadCountElement = sidebarItem.querySelector(`[data-count-for="#${tag}"]`);
        unreadCountElement.textContent = unreadCountString;
        if (unreadCountElement.closest('li')) {
          unreadCountElement.closest('li').dataset.new = isNew;
        }
        if (isNew) {
          hasNew = true;
        }
      }
    }
    sidebarItem.dataset.hasNew = hasNew;
  }
};

const loadInitialCounts = async () => {
  for (const tag of trackedTags) {
    initialLoadTags.includes(tag) || console.log(`Tag Tracking+: skipping initial refresh for ${tag}; it's fresh`);

    await Promise.all([
      initialLoadTags.includes(tag) && refreshCount(tag),
      new Promise(resolve => setTimeout(resolve, 500)),
    ]);
  }
  sidebarItem.dataset.loading = false;
};

const refreshOldestCount = async () => {
  const oldestTag =
    trackedTags.find(tag => !unreadCounts[tag]) ||
    trackedTags.find(tag => unreadCounts[tag].unreadCountString === '⚠️') ||
    [...trackedTags].sort((a, b) => unreadCounts[a].updated - unreadCounts[b].updated).at(0);
  await refreshCount(oldestTag);
};

let intervalId = 0;
const startRefreshInterval = () => { intervalId = setInterval(refreshOldestCount, REFRESH_INTERVAL); };
const stopRefreshInterval = () => clearInterval(intervalId);

// Resume refresh interval if other tab that was "driving" is definitely closed.
// Stagger resume timeout randomly so that if multiple tabs are waiting, only one becomes "driver".
const debouncedResumeRefreshInterval = debounce(
  () => { refreshOldestCount(); startRefreshInterval(); },
  REFRESH_INTERVAL * (1.25 + Math.random() * 0.5),
);

const onOtherTabRefresh = ({ data: tag }) => {
  console.log('Tag Tracking+: Received update from different tab; pausing refresh interval');

  initialLoadTags = initialLoadTags.filter(initialLoadTag => initialLoadTag !== tag);

  stopRefreshInterval();
  debouncedResumeRefreshInterval();
};

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
    renderRefreshedCounts();
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

  initialLoadTags = trackedTags.filter(
    tag => !unreadCounts[tag] || Date.now() - unreadCounts[tag].updated > UNREAD_COUNT_TTL,
  );

  sidebarItem.dataset.onlyShowNew = onlyShowNew;
  sidebarItem.dataset.loading = true;

  renderRefreshedCounts();

  otherTabRefreshChannel = new BroadcastChannel('xkit-tag-tracking-plus-refresh-sync');
  otherTabRefreshChannel.addEventListener('message', onOtherTabRefresh);

  onNewPosts.addListener(processPosts);
  loadInitialCounts().then(startRefreshInterval);
};

export const clean = async function () {
  stopRefreshInterval();
  onNewPosts.removeListener(processPosts);

  removeSidebarItem('tag-tracking-plus');

  debouncedResumeRefreshInterval.cancel();
  otherTabRefreshChannel?.close();
};

export const stylesheet = true;
