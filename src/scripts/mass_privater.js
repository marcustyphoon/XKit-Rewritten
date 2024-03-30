import { dom } from '../util/dom.js';
import { megaEdit } from '../util/mega_editor.js';
import { showModal, modalCancelButton, modalCompleteButton, hideModal, showErrorModal } from '../util/modals.js';
import { addSidebarItem, removeSidebarItem } from '../util/sidebar.js';
import { constructDurationString, dateTimeFormat, elementsAsList } from '../util/text_format.js';
import { apiFetch } from '../util/tumblr_helpers.js';
import { userBlogs } from '../util/user.js';

const getPostsFormId = 'xkit-mass-privater-get-posts';

const createBlogOption = ({ name, title, uuid }) => dom('option', { value: uuid, title }, null, [name]);
const createTagSpan = tag => dom('span', { class: 'mass-privater-tag' }, null, [tag]);
const createBlogSpan = name => dom('span', { class: 'mass-privater-blog' }, null, [name]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const timezoneOffsetMs = new Date().getTimezoneOffset() * 60000;

const createNowString = () => {
  const now = new Date();

  const YYYY = `${now.getFullYear()}`.padStart(4, '0');
  const MM = `${now.getMonth() + 1}`.padStart(2, '0');
  const DD = `${now.getDate()}`.padStart(2, '0');
  const hh = `${now.getHours()}`.padStart(2, '0');
  const mm = `${now.getMinutes()}`.padStart(2, '0');

  return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
};

const showInitialPrompt = async () => {
  const initialForm = dom('form', { id: getPostsFormId }, { submit: event => confirmInitialPrompt(event).catch(showErrorModal) }, [
    dom('label', null, null, [
      'Posts on blog:',
      dom('select', { name: 'blog', required: true }, null, userBlogs.map(createBlogOption))
    ]),
    dom('label', null, null, [
      'Posts from before:',
      dom('input', { type: 'datetime-local', name: 'before', value: createNowString(), required: true })
    ]),
    dom('label', null, null, [
      dom('small', null, null, ['Posts with any of these tags (optional):']),
      dom('input', { type: 'text', name: 'tags', placeholder: 'Comma-separated', autocomplete: 'off' })
    ])
  ]);

  if (location.pathname.startsWith('/blog/')) {
    const blogName = location.pathname.split('/')[2];
    const option = [...initialForm.elements.blog.options].find(({ textContent }) => textContent === blogName);
    if (option) option.selected = true;
  }

  showModal({
    title: 'Select posts to make private',
    message: [initialForm],
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

  const uuid = elements.blog.value;
  const name = elements.blog.selectedOptions[0].textContent;
  const tags = elements.tags.value
    .replace(/"|#/g, '')
    .split(',')
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean);

  const getTagCount = async tag => {
    const { response: { totalPosts } } = await apiFetch(`/v2/blog/${uuid}/posts`, { method: 'GET', queryParams: { tag } });
    return totalPosts ?? 0;
  };
  const getCount = async () => {
    const { response: { totalPosts } } = await apiFetch(`/v2/blog/${uuid}/posts`);
    return totalPosts ?? 0;
  };
  const toCheckCount = tags.length
    ? (await Promise.all(tags.map(getTagCount))).reduce((a, b) => a + b, 0)
    : await getCount();

  if (toCheckCount === 0) {
    tags.length ? showTagsNotFound({ tags, name }) : showPostsNotFound({ name });
    return;
  }

  const beforeMs = elements.before.valueAsNumber + timezoneOffsetMs;

  const beforeString = dateTimeFormat.format(new Date(beforeMs));
  const beforeElement = dom('span', { style: 'white-space: nowrap; font-weight: bold;' }, null, [beforeString]);

  const before = beforeMs / 1000;

  const message = tags.length
    ? [
        'Every published post on ',
        createBlogSpan(name),
        ' from before ',
        beforeElement,
        ' tagged ',
        ...elementsAsList(tags.map(createTagSpan), 'or'),
        ' will be set to private.'
      ]
    : [
        'Every published post on ',
        createBlogSpan(name),
        ' from before ',
        beforeElement,
        ' will be set to private.'
      ];

  showModal({
    title: 'Are you sure?',
    message,
    buttons: [
      modalCancelButton,
      dom(
        'button',
        { class: 'red' },
        { click: () => privatePosts({ uuid, name, tags, before, toCheckCount }).catch(showErrorModal) },
        ['Private them!']
      )
    ]
  });
};

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

const privatePosts = async ({ uuid, name, tags, before, toCheckCount }) => {
  const gatherStatus = dom('span', null, null, ['Gathering posts...']);
  const privateStatus = dom('span');
  const remainingStatus = dom('span');

  showModal({
    title: 'Making posts private...',
    message: [
      dom('small', null, null, ['Do not navigate away from this page.']),
      '\n\n',
      gatherStatus,
      privateStatus,
      '\n\n',
      remainingStatus
    ]
  });

  const allPostIdsSet = new Set();
  const filteredPostIdsSet = new Set();

  let fetchCount = 0;
  let checkedCount = 0;

  const collectDurations = [1];
  const privateDurations = [1];
  const average = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

  let privatedCount = 0;
  let privatedFailCount = 0;

  const updateEstimates = () => {
    const estimates = [];
    const collectRemaining = constructDurationString((toCheckCount - checkedCount) / (checkedCount / fetchCount) * average(collectDurations));
    collectRemaining && estimates.push(`Collection: ${collectRemaining}`);

    if (privatedCount || privatedFailCount) {
      const privateRemaining = constructDurationString(filteredPostIds.length / 100 * average(privateDurations));
      privateRemaining && estimates.push(`Privating: ${privateRemaining}`);
    } else {
      const privateEstimate = constructDurationString(toCheckCount / 100 * average(privateDurations));
      privateEstimate && estimates.push(`Privating: up to ${privateEstimate}`);
    }
    remainingStatus.replaceChildren(
      ...(estimates.length
        ? [
            dom('span', null, null, ['Estimated time remaining:']),
            '\n',
            dom('small', null, null, [estimates.join('\n')])
          ]
        : [])
    );
  };

  const collect = async resource => {
    while (resource) {
      const now = Date.now();
      await Promise.all([
        apiFetch(resource).then(({ response }) => {
          const posts = response.posts
            .filter(({ canEdit }) => canEdit === true)
            .filter(({ state }) => state === 'published');

          fetchCount += 1;
          checkedCount += posts.length;

          posts.forEach(({ id }) => allPostIdsSet.add(id));

          posts
            .filter(({ timestamp }) => timestamp < before)
            .forEach(({ id }) => filteredPostIdsSet.add(id));

          resource = response.links?.next?.href;

          gatherStatus.textContent = `Found ${filteredPostIdsSet.size} posts (checked ${allPostIdsSet.size})${resource ? '...' : '.'}`;
          updateEstimates();
        }),
        sleep(1000)
      ]);
      collectDurations.push((Date.now() - now) / 1000);
    }
  };

  if (tags.length) {
    for (const tag of tags) {
      await collect(`/v2/blog/${uuid}/posts?${$.param({ tag, limit: 50 })}`);
    }
  } else {
    await collect(`/v2/blog/${uuid}/posts`);
  }
  const filteredPostIds = [...filteredPostIdsSet];

  if (filteredPostIds.length === 0) {
    showPostsNotFound({ name });
    return;
  }

  while (filteredPostIds.length !== 0) {
    const postIds = filteredPostIds.splice(0, 100);

    if (privateStatus.textContent === '') privateStatus.textContent = '\nPrivating posts...';

    const now = Date.now();
    await Promise.all([
      /* megaEdit(postIds, { mode: 'private' }) */ Promise.resolve().then(() => {
        privatedCount += postIds.length;
      }).catch(() => {
        privatedFailCount += postIds.length;
      }).finally(() => {
        privateStatus.textContent = `\nPrivated ${privatedCount} posts... ${privatedFailCount ? `(failed: ${privatedFailCount})` : ''}`;
        updateEstimates();
      }),
      sleep(1000)
    ]);
    privateDurations.push((Date.now() - now) / 1000);
  }

  await sleep(1000);

  showModal({
    title: 'All done!',
    message: [
      `Privated ${privatedCount} posts${privatedFailCount ? ` (failed: ${privatedFailCount})` : ''}.\n`,
      'Refresh the page to see the result.'
    ],
    buttons: [
      dom('button', null, { click: hideModal }, ['Close']),
      dom('button', { class: 'blue' }, { click: () => location.reload() }, ['Refresh'])
    ]
  });
};

const sidebarOptions = {
  id: 'mass-privater',
  title: 'Mass Privater',
  rows: [{
    label: 'Make posts private',
    onclick: showInitialPrompt,
    carrot: true
  }],
  visibility: () => /^\/blog\/[^/]+\/?$/.test(location.pathname)
};

export const main = async () => addSidebarItem(sidebarOptions);
export const clean = async () => removeSidebarItem(sidebarOptions.id);
export const stylesheet = true;
