import { sha256 } from '../utils/crypto.js';
import { dom } from '../utils/dom.js';
import { showModal, modalCancelButton, modalCompleteButton, hideModal, showErrorModal } from '../utils/modals.js';
import { addSidebarItem, removeSidebarItem } from '../utils/sidebar.js';
import { apiFetch } from '../utils/tumblr_helpers.js';
import { userBlogs } from '../utils/user.js';

const getPostsFormId = 'xkit-sideblog-queue-form';
const sourceBlogStorageKey = 'quick_reblog.rememberedSourceBlogs';
const targetBlogStorageKey = 'quick_reblog.rememberedTargetBlogs';
const afterStorageKey = 'quick_reblog.rememberedAfterValue';
const tagsStorageKey = 'quick_reblog.rememberedTagsValue';

const createBlogOption = ({ name, title, uuid }) => dom('option', { value: uuid, title }, null, [name]);
const createTagSpan = tag => dom('span', { class: 'sideblog-queue-tag' }, null, [tag]);
const createBlogSpan = name => dom('span', { class: 'sideblog-queue-blog' }, null, [name]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const defaultAfter = '2006-09-29T00:00';

const dateTimeFormat = new Intl.DateTimeFormat(document.documentElement.lang, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  timeZoneName: 'short'
});

/**
 * Adds string elements between an array's items to format it as an English prose list.
 * The Oxford comma is included.
 * @param {any[]} array - Input array of any number of items
 * @param {string} andOr - String 'and' or 'or', used before the last item
 * @returns {any[]} An array alternating between the input items and strings
 */
const elementsAsList = (array, andOr) =>
  array.flatMap((item, i) => {
    if (i === array.length - 1) return [item];
    if (i === array.length - 2) return array.length === 2 ? [item, ` ${andOr} `] : [item, `, ${andOr} `];
    return [item, ', '];
  });

const timezoneOffsetMs = new Date().getTimezoneOffset() * 60000;

const persistSelections = async ({ sourceBlogElement, targetBlogElement, afterElement, tagsElement }) => {
  const {
    [sourceBlogStorageKey]: rememberedSourceBlogs = {},
    [targetBlogStorageKey]: rememberedTargetBlogs = {},
    [afterStorageKey]: afterValue = defaultAfter,
    [tagsStorageKey]: tagsValue = ''
  } = await browser.storage.local.get([
    sourceBlogStorageKey,
    targetBlogStorageKey,
    afterStorageKey,
    tagsStorageKey
  ]);

  const blogHashes = new Map();

  for (const { uuid } of userBlogs) {
    blogHashes.set(uuid, await sha256(uuid));
  }
  const { uuid: primaryUuid } = userBlogs.find(({ primary }) => primary === true);
  const accountKey = blogHashes.get(primaryUuid);

  const sourceBlogHash = rememberedSourceBlogs[accountKey];
  const sourceBlogUuid = [...blogHashes.keys()].find(uuid => blogHashes.get(uuid) === sourceBlogHash);
  if (sourceBlogUuid) sourceBlogElement.value = sourceBlogUuid;

  const targetBlogHash = rememberedTargetBlogs[accountKey];
  const targetBlogUuid = [...blogHashes.keys()].find(uuid => blogHashes.get(uuid) === targetBlogHash);
  if (targetBlogUuid) targetBlogElement.value = targetBlogUuid;

  const updateRememberedBlog = storageKey => async ({ currentTarget: { value: selectedBlog } }) => {
    const {
      [storageKey]: rememberedBlogs = {}
    } = await browser.storage.local.get(storageKey);

    const blogHash = blogHashes.get(selectedBlog);

    rememberedBlogs[accountKey] = blogHash;
    browser.storage.local.set({ [storageKey]: rememberedBlogs });
  };

  sourceBlogElement.addEventListener('change', updateRememberedBlog(sourceBlogStorageKey));
  targetBlogElement.addEventListener('change', updateRememberedBlog(targetBlogStorageKey));

  const updateRememberedValue = storageKey => ({ currentTarget: { value } }) => {
    browser.storage.local.set({ [storageKey]: value });
  };

  afterElement.value = afterValue;
  afterElement.addEventListener('input', updateRememberedValue(afterStorageKey));
  tagsElement.value = tagsValue;
  tagsElement.addEventListener('input', updateRememberedValue(tagsStorageKey));
};

const showInitialPrompt = async () => {
  const initialForm = dom('form', { id: getPostsFormId }, { submit: event => confirmInitialPrompt(event).catch(showErrorModal) }, [
    dom('label', null, null, [
      'Posts on this blog:',
      dom('select', { name: 'sourceblog', required: true }, null, userBlogs.map(createBlogOption))
    ]),
    dom('label', null, null, [
      'Posts with any of these tags:',
      dom('input', { type: 'text', name: 'tags', placeholder: 'Comma-separated', autocomplete: 'off' })
    ]),
    dom('label', null, null, [
      'Posts from after:',
      dom('input', { type: 'datetime-local', name: 'after', value: defaultAfter, required: true })
    ]),
    dom('div'),
    dom('label', null, null, [
      'Target blog:',
      dom('select', { name: 'targetblog', required: true }, null, userBlogs.map(createBlogOption))
    ])
  ]);

  await persistSelections({
    sourceBlogElement: initialForm.elements.sourceblog,
    targetBlogElement: initialForm.elements.targetblog,
    afterElement: initialForm.elements.after,
    tagsElement: initialForm.elements.tags
  });

  showModal({
    title: 'Select posts to queue',
    message: [
      initialForm,
      dom('small', null, null, [
        'Posts will not be queued if they already exist on the target blog or in its queue with the matching tag.\n'
      ])],
    buttons: [
      modalCancelButton,
      dom('input', { class: 'blue', type: 'submit', form: getPostsFormId, value: 'Next' })
    ]
  });
};

const confirmInitialPrompt = async event => {
  event.preventDefault();

  const { submitter } = event;
  if (submitter.matches('input[type="submit"]')) {
    submitter.disabled = true;
    submitter.value = 'Checking...';
  }

  const { elements } = event.currentTarget;

  const sourceUuid = elements.sourceblog.value;
  const sourceName = elements.sourceblog.selectedOptions[0].textContent;
  const targetUuid = elements.targetblog.value;
  const targetName = elements.targetblog.selectedOptions[0].textContent;

  const tags = elements.tags.value
    .replace(/"|#/g, '')
    .split(',')
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean);

  if (tags.length) {
    const getTagCount = async tag => {
      const { response: { totalPosts } } = await apiFetch(`/v2/blog/${sourceUuid}/posts`, { method: 'GET', queryParams: { tag } });
      return totalPosts ?? 0;
    };
    const counts = await Promise.all(tags.map(getTagCount));
    const count = counts.reduce((a, b) => a + b, 0);

    if (count === 0) {
      showTagsNotFound({ tags, name: sourceName });
      return;
    }
  } else {
    showNoTagsSelected({ tags });
    return;
  }

  const afterMs = elements.after.valueAsNumber + timezoneOffsetMs;

  const afterString = dateTimeFormat.format(new Date(afterMs));
  const afterElement = dom('span', { style: 'white-space: nowrap; font-weight: bold;' }, null, [afterString]);

  const after = afterMs / 1000;

  const message = [
    'Every published post on ',
    createBlogSpan(sourceName),
    ' tagged ',
    ...elementsAsList(tags.map(createTagSpan), 'or'),
    ' from after ',
    afterElement,
    ' will be queued on ',
    createBlogSpan(targetName),
    " if it isn't already."
  ];

  showModal({
    title: 'Are you sure?',
    message,
    buttons: [
      modalCancelButton,
      dom(
        'button',
        { class: 'red' },
        { click: () => queuePosts({ sourceUuid, sourceName, targetUuid, targetName, tags, after }).catch(showErrorModal) },
        ['Queue them!']
      )
    ]
  });
};

const showNoTagsSelected = () =>
  showModal({
    title: 'No tags selected!',
    message: ["You didn't select any tags! Please try again."],
    buttons: [modalCompleteButton]
  });

const showTagsNotFound = ({ tags, name }) =>
  showModal({
    title: 'No tagged posts found!',
    message: [
      "It looks like you don't have any posts tagged ",
      ...elementsAsList(tags.map(createTagSpan), 'or'),
      ' on ',
      createBlogSpan(name),
      '. Did you misspell a tag?'
    ],
    buttons: [modalCompleteButton]
  });

const showPostsNotFound = ({ name }) =>
  showModal({
    title: 'No posts found!',
    message: [
      "It looks like you don't have any posts with the specified criteria on ",
      createBlogSpan(name),
      '.'
    ],
    buttons: [modalCompleteButton]
  });

const showPostsAlreadyQueued = ({ sourceName, targetName }) =>
  showModal({
    title: 'Posts already queued!',
    message: [
      'It looks like every post with the specified criteria on ',
      createBlogSpan(sourceName),
      ' is already reblogged or queued on ',
      createBlogSpan(targetName),
      '!'
    ],
    buttons: [modalCompleteButton]
  });

const queuePosts = async ({ sourceUuid, sourceName, targetUuid, targetName, tags, after }) => {
  const targetGatherStatus = dom('span', null, null, ['Gathering posts...']);
  const sourceGatherStatus = dom('span');
  const queueStatus = dom('span');

  if (!tags.length) {
    throw new Error('no tags selected!');
  }

  showModal({
    title: 'Queueing posts...',
    message: [
      dom('small', null, null, ['Do not navigate away from this page.']),
      '\n\n',
      targetGatherStatus,
      sourceGatherStatus,
      queueStatus
    ]
  });

  let fetchedTargetPosts = 0;
  const targetPostIdsSet = new Set();
  const collectTarget = async resource => {
    while (resource) {
      await Promise.all([
        apiFetch(resource).then(({ response }) => {
          response.posts
            .forEach(({ id, rebloggedRootId }) => targetPostIdsSet.add(rebloggedRootId || id));

          fetchedTargetPosts += response.posts.length;

          resource = response.links?.next?.href;

          targetGatherStatus.textContent = `Found ${targetPostIdsSet.size} posts already on target (checked ${fetchedTargetPosts})${resource ? '...' : '.'}\n`;
        }),
        sleep(1000)
      ]);
    }
  };
  for (const tag of tags) {
    await collectTarget(`/v2/blog/${targetUuid}/posts?${$.param({ tag, limit: 50, reblog_info: true })}`);
  }
  for (const tag of tags) {
    await collectTarget(`/v2/blog/${targetUuid}/posts/queue?${$.param({ tag, limit: 50, reblog_info: true })}`);
  }

  let fetchedSourcePosts = 0;
  const toQueuePostsMap = new Map();
  const collectSource = async resource => {
    while (resource) {
      await Promise.all([
        apiFetch(resource).then(({ response }) => {
          response.posts
            .filter(({ canEdit }) => canEdit === true)
            .filter(({ state }) => state === 'published')
            .filter(({ timestamp }) => timestamp > after)
            .forEach((postData) => toQueuePostsMap.set(postData.rebloggedRootId || postData.id, postData));

          fetchedSourcePosts += response.posts.length;

          resource = response.links?.next?.href;

          sourceGatherStatus.textContent = `Found ${toQueuePostsMap.size} posts on source (checked ${fetchedSourcePosts})${resource ? '...' : '.'}\n`;
        }),
        sleep(1000)
      ]);
    }
  };
  for (const tag of tags) {
    await collectSource(`/v2/blog/${sourceUuid}/posts?${$.param({ tag, after, limit: 50, reblog_info: true })}`);
  }

  if (toQueuePostsMap.size === 0) {
    showPostsNotFound({ name: sourceName });
    return;
  }

  targetPostIdsSet.forEach((id) => toQueuePostsMap.delete(id));

  if (toQueuePostsMap.size === 0) {
    showPostsAlreadyQueued({ sourceName, targetName });
    return;
  }

  const toQueuePosts = [...toQueuePostsMap.values()];

  toQueuePosts.sort((a, b) => a.timestamp - b.timestamp);

  let queuedCount = 0;
  let queuedFailCount = 0;

  while (toQueuePosts.length !== 0) {
    const postData = toQueuePosts.shift();

    if (queueStatus.textContent === '') queueStatus.textContent = '\nQueueing posts...';

    const tagsToApply = tags.filter(tag => postData.tags.includes(tag));

    await Promise.all([
      apiFetch(`/v2/blog/${targetName}/posts`, {
        method: 'POST',
        body: {
          content: [],
          tags: tagsToApply.join(','),
          parent_post_id: postData.id,
          parent_tumblelog_uuid: sourceUuid,
          reblog_key: postData.reblogKey,
          state: 'queue'
        }
      }).then(() => {
        queuedCount++;
      }).catch(() => {
        queuedFailCount++;
      }).finally(() => {
        queueStatus.textContent = `Queued ${queuedCount} posts... ${queuedFailCount ? `(failed: ${queuedFailCount})` : ''}`;
      }),
      sleep(1000)
    ]);
  }

  await sleep(1000);

  showModal({
    title: 'All done!',
    message: [
      `Queued ${queuedCount} posts${queuedFailCount ? ` (failed: ${queuedFailCount})` : ''}.\n`,
      'You may have to refresh the queue page to see the new posts.'
    ],
    buttons: [dom('button', null, { click: hideModal }, ['Close'])]
  });
};

const sidebarOptions = {
  id: 'sideblog-queue',
  title: 'Sideblog Queue',
  rows: [{
    label: 'Queue posts to sideblog',
    onclick: showInitialPrompt,
    carrot: true
  }]
};

export const main = async () => addSidebarItem(sidebarOptions);
export const clean = async () => removeSidebarItem(sidebarOptions.id);
export const stylesheet = true;
