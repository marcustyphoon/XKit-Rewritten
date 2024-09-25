import { filterPostElements, postSelector, getTimelineItemWrapper } from '../utils/interface.js';
import { registerBlogMeatballItem, registerMeatballItem, unregisterBlogMeatballItem, unregisterMeatballItem } from '../utils/meatballs.js';
import { showModal, hideModal, modalCancelButton } from '../utils/modals.js';
import { timelineObject } from '../utils/react_props.js';
import { onNewPosts } from '../utils/mutations.js';
import { keyToCss } from '../utils/css_map.js';
import { dom } from '../utils/dom.js';
import { getPreferences } from '../utils/preferences.js';
import { anyBlogPostTimelineFilter, anyBlogTimelineFilter, channelSelector, likesTimelineFilter, timelineSelector } from '../utils/timeline_id.js';

const meatballButtonId = 'mute';
const meatballButtonLabel = data => `Mute options for ${data.name ?? getVisibleBlog(data).name}`;

const hiddenAttribute = 'data-mute-hidden';
const mutedBlogHiddenAttribute = 'data-muted-blog-hidden';
const activeClass = 'xkit-mute-active';
const mutedBlogControlsClass = 'xkit-muted-blog-controls';
const lengthenedClass = 'xkit-mute-lengthened';

const blogNamesStorageKey = 'mute.blogNames';
const mutedBlogsEntriesStorageKey = 'mute.mutedBlogEntries';

let checkTrail;
let contributedContentOriginal;

let blogNames = {};
let mutedBlogs = {};

const lengthenTimeline = timeline => {
  if (!timeline.querySelector(keyToCss('manualPaginatorButtons'))) {
    timeline.classList.add(lengthenedClass);
  }
};

const exactly = string => `^${string}$`;
const captureAnyBlog = '(t:[a-zA-Z0-9-_]{22}|[a-z0-9-]{1,32})';
const uuidV4 = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}';

const getNameOrUuid = ({ dataset: { timeline, timelineId } }) =>
  [
    timeline?.match(exactly(`/v2/blog/${captureAnyBlog}/posts`)),
    timelineId?.match(exactly(`peepr-posts-${captureAnyBlog}-undefined-undefined-undefined-undefined-undefined-undefined`)),
    timelineId?.match(exactly(`blog-view-${captureAnyBlog}`)),
    timelineId?.match(exactly(`blog-${uuidV4}-${captureAnyBlog}`))
  ]
    .map(match => match?.[1])
    .find(Boolean);

// Attempts to get the blog name and blog UUID of a timeline element if it contains the posts from a single blog.
// The element itself doesn't contain both values, so a post object must be found with the required data.
const getNameAndUuid = async timelineElement => {
  const nameOrUuid = getNameOrUuid(timelineElement);
  for (const post of [...timelineElement.querySelectorAll(postSelector)]) {
    const { blog: { name, uuid } } = await timelineObject(post);
    if ([name, uuid].includes(nameOrUuid)) return { name, uuid };
  }
  throw new Error('could not determine blog name / UUID for timeline element:', timelineElement);
};

const processBlogTimelineElement = async timelineElement => {
  const { name, uuid } = await getNameAndUuid(timelineElement);
  const mode = mutedBlogs[uuid];

  if (mode) {
    timelineElement.dataset.muteBlogUuid = uuid;

    const mutedBlogControls = dom('div', { class: mutedBlogControlsClass }, null, [
      `You have muted ${mode} posts from ${name}!`,
      dom('br'),
      dom('button', null, { click: () => mutedBlogControls.remove() }, ['show posts anyway'])
    ]);
    mutedBlogControls.dataset.mode = mode;

    timelineElement.querySelector(keyToCss('scrollContainer')).before(mutedBlogControls);
  }
};

const getLocation = timelineElement => {
  const on = {
    channel: timelineElement.matches(channelSelector),
    singlePostBlogView: anyBlogPostTimelineFilter(timelineElement),
    likes: likesTimelineFilter(timelineElement),

    activeBlogTimeline: anyBlogTimelineFilter(timelineElement),
    active: true
  };
  return Object.keys(on).find(location => on[location]);
};

const processTimelines = async timelineElements => {
  for (const timelineElement of [...new Set(timelineElements)]) {
    const { timeline, timelineId, muteProcessedTimeline, muteProcessedTimelineId } = timelineElement.dataset;

    const alreadyProcessed =
      (timeline && timeline === muteProcessedTimeline) ||
      (timelineId && timelineId === muteProcessedTimelineId);
    if (alreadyProcessed) continue;

    timelineElement.dataset.muteProcessedTimeline = timeline;
    timelineElement.dataset.muteProcessedTimelineId = timelineId;

    [...timelineElement.querySelectorAll(`.${mutedBlogControlsClass}`)].forEach(el => el.remove());
    delete timelineElement.dataset.muteBlogUuid;
    timelineElement.classList.remove(activeClass);

    const location = getLocation(timelineElement);

    if (['active', 'activeBlogTimeline'].includes(location)) {
      timelineElement.classList.add(activeClass);
      lengthenTimeline(timelineElement);

      if (location === 'activeBlogTimeline') {
        await processBlogTimelineElement(timelineElement).catch(console.log);
      }
    }
  }
};

const updateStoredName = (uuid, name) => {
  blogNames[uuid] = name;
  Object.keys(blogNames).forEach(uuid => {
    if (!mutedBlogs[uuid]) {
      delete blogNames[uuid];
    }
  });
  browser.storage.local.set({ [blogNamesStorageKey]: blogNames });
};

const getVisibleBlog = ({ blog, authorBlog, community }) => (community ? authorBlog : blog);

const processPosts = async function (postElements) {
  await processTimelines(postElements.map(postElement => postElement.closest(timelineSelector)));

  filterPostElements(postElements, { includeFiltered: true }).forEach(async postElement => {
    const timelineObjectData = await timelineObject(postElement);
    const { uuid, name } = getVisibleBlog(timelineObjectData);
    const { rebloggedRootUuid, content = [], trail = [] } = timelineObjectData;

    const { muteBlogUuid: timelineBlogUuid } = postElement.closest(timelineSelector).dataset;

    if (mutedBlogs[uuid] && blogNames[uuid] !== name) {
      updateStoredName(uuid, name);
    }

    const isRebloggedPost = contributedContentOriginal
      ? rebloggedRootUuid && !content.length
      : rebloggedRootUuid;

    const originalUuid = isRebloggedPost ? rebloggedRootUuid : uuid;
    const reblogUuid = isRebloggedPost ? uuid : null;

    if (['all', 'original'].includes(mutedBlogs[originalUuid])) {
      getTimelineItemWrapper(postElement).setAttribute(
        originalUuid === timelineBlogUuid ? mutedBlogHiddenAttribute : hiddenAttribute,
        ''
      );
    }
    if (['all', 'reblogged'].includes(mutedBlogs[reblogUuid])) {
      getTimelineItemWrapper(postElement).setAttribute(
        reblogUuid === timelineBlogUuid ? mutedBlogHiddenAttribute : hiddenAttribute,
        ''
      );
    }

    if (checkTrail) {
      for (const { blog } of trail) {
        if (['all'].includes(mutedBlogs[blog?.uuid])) {
          getTimelineItemWrapper(postElement).setAttribute(
            blog?.uuid === timelineBlogUuid ? mutedBlogHiddenAttribute : hiddenAttribute,
            ''
          );
        }
      }
    }
  });
};

const onMeatballButtonClicked = function ({ currentTarget }) {
  const { name, uuid } = currentTarget.__timelineObjectData
    ? getVisibleBlog(currentTarget.__timelineObjectData)
    : currentTarget.__blogData;

  const currentMode = mutedBlogs[uuid];

  const createRadioElement = value =>
    dom('label', null, null, [
      `Hide ${value} posts`,
      dom('input', { type: 'radio', name: 'muteOption', value })
    ]);

  const form = dom(
    'form',
    { id: 'xkit-mute-form', 'data-name': name, 'data-uuid': uuid },
    { submit: muteUser },
    [
      createRadioElement('all'),
      createRadioElement('original'),
      createRadioElement('reblogged')
    ]
  );

  form.elements.muteOption.value = currentMode;

  currentMode
    ? showModal({
      title: `Mute options for ${name}:`,
      message: [form],
      buttons: [
        modalCancelButton,
        dom('button', { class: 'blue' }, { click: () => unmuteUser(uuid) }, ['Unmute']),
        dom('input', { type: 'submit', form: form.id, class: 'red', value: 'Update Mute' })
      ]
    })
    : showModal({
      title: `Mute ${name}?`,
      message: [form],
      buttons: [
        modalCancelButton,
        dom('input', { type: 'submit', form: form.id, class: 'red', value: 'Mute' })
      ]
    });
};

const muteUser = event => {
  event.preventDefault();

  const { name, uuid } = event.currentTarget.dataset;
  const { value } = event.currentTarget.elements.muteOption;
  if (value === '') return;

  mutedBlogs[uuid] = value;
  blogNames[uuid] = name;

  browser.storage.local.set({
    [mutedBlogsEntriesStorageKey]: Object.entries(mutedBlogs),
    [blogNamesStorageKey]: blogNames
  });

  hideModal();
};

const unmuteUser = uuid => {
  delete mutedBlogs[uuid];
  browser.storage.local.set({ [mutedBlogsEntriesStorageKey]: Object.entries(mutedBlogs) });

  hideModal();
};

export const onStorageChanged = async function (changes, areaName) {
  const {
    [blogNamesStorageKey]: blogNamesChanges,
    [mutedBlogsEntriesStorageKey]: mutedBlogsEntriesChanges
  } = changes;

  if (
    Object.keys(changes).some(key => key.startsWith('mute.preferences') && changes[key].oldValue !== undefined) ||
    mutedBlogsEntriesChanges
  ) {
    clean().then(main);
    return;
  }

  if (blogNamesChanges) {
    ({ newValue: blogNames } = blogNamesChanges);
  }
};

export const main = async function () {
  ({ checkTrail, contributedContentOriginal } = await getPreferences('mute'));
  ({ [blogNamesStorageKey]: blogNames = {} } = await browser.storage.local.get(blogNamesStorageKey));
  const { [mutedBlogsEntriesStorageKey]: mutedBlogsEntries } = await browser.storage.local.get(mutedBlogsEntriesStorageKey);
  mutedBlogs = Object.fromEntries(mutedBlogsEntries ?? []);

  registerMeatballItem({
    id: meatballButtonId,
    label: meatballButtonLabel,
    onclick: onMeatballButtonClicked
  });
  registerBlogMeatballItem({
    id: meatballButtonId,
    label: meatballButtonLabel,
    onClick: onMeatballButtonClicked
  });
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  unregisterMeatballItem(meatballButtonId);
  unregisterBlogMeatballItem(meatballButtonId);
  onNewPosts.removeListener(processPosts);

  $(`[${hiddenAttribute}]`).removeAttr(hiddenAttribute);
  $(`[${mutedBlogHiddenAttribute}]`).removeAttr(mutedBlogHiddenAttribute);
  $(`.${activeClass}`).removeClass(activeClass);
  $(`.${lengthenedClass}`).removeClass(lengthenedClass);
  $(`.${mutedBlogControlsClass}`).remove();
  $('[data-mute-processed-timeline]').removeAttr('data-mute-processed-timeline');
  $('[data-mute-processed-timeline-id]').removeAttr('data-mute-processed-timeline-id');
  $('[data-mute-blog-uuid]').removeAttr('data-mute-blog-uuid');
};

export const stylesheet = true;
