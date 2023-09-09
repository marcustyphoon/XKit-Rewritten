import { dom } from '../util/dom.js';
import {
  hideModal,
  modalCancelButton,
  modalCompleteButton,
  showModal
} from '../util/modals.js';
import { addSidebarItem, removeSidebarItem } from '../util/sidebar.js';
import { apiFetch, createEditRequestBody } from '../util/tumblr_helpers.js';
import { userBlogs } from '../util/user.js';

const getPostsFormId = 'xkit-queue-to-drafts-get-posts';

const createBlogOption = ({ name, title, uuid }) => dom('option', { value: uuid, title }, null, [name]);
const createBlogSpan = name => dom('span', { class: 'queue-to-drafts-blog' }, null, [name]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const showInitialPrompt = async () => {
  const initialForm = dom('form', { id: getPostsFormId }, { submit: confirmInitialPrompt }, [
    'Move all of your queued posts to drafts?',
    dom('label', null, null, [
      'Posts on blog:',
      dom('select', { name: 'blog', required: true }, null, userBlogs.map(createBlogOption))
    ])
  ]);

  if (location.pathname.startsWith('/blog/')) {
    const blogName = location.pathname.split('/')[2];
    const option = [...initialForm.elements.blog.options].find(({ textContent }) => textContent === blogName);
    if (option) option.selected = true;
  }

  showModal({
    title: 'Queue to Drafts:',
    message: [
      initialForm,
      dom('small', null, null, ['Note: This may take a long time (~3300 posts/hour).'])
    ],
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

  showModal({
    title: 'Are you sure?',
    message: [
      'Every queued post on ',
      createBlogSpan(name),
      ' will be moved to your drafts folder.'
    ],
    buttons: [
      modalCancelButton,
      dom(
        'button',
        { class: 'red' },
        {
          click: () => draftPosts({ uuid, name }).catch(showError)
        },
        ['Go!']
      )
    ]
  });
};

const showPostsNotFound = ({ name }) =>
  showModal({
    title: 'No posts found!',
    message: ["It looks like you don't have any queued posts on ", createBlogSpan(name), '.'],
    buttons: [modalCompleteButton]
  });

const showError = exception =>
  showModal({
    title: 'Something went wrong.',
    message: [exception.message],
    buttons: [modalCompleteButton]
  });

const draftPosts = async ({ uuid, name }) => {
  const gatherStatus = dom('span', null, null, ['Gathering posts...']);
  const toggleStatus = dom('span');

  showModal({
    title: 'Moving queued posts to drafts...',
    message: [
      dom('small', null, null, ['Do not navigate away from this page.']),
      '\n\n',
      gatherStatus,
      '\n',
      toggleStatus
    ]
  });

  const postsMap = new Map();

  const collect = async resource => {
    while (resource) {
      await Promise.all([
        apiFetch(resource).then(({ response }) => {
          const posts = response.posts
            .filter(({ canEdit }) => canEdit === true)
            .filter(({ state }) => state === 'queued');

          posts.forEach(postData => postsMap.set(postData.id, postData));

          resource = response.links?.next?.href;

          gatherStatus.textContent = `Found ${postsMap.size} posts${resource ? '...' : '.'}`;
        }),
        sleep(1000)
      ]);
    }
  };

  await collect(`/v2/blog/${uuid}/posts/queue?${$.param({ reblog_info: true })}`);

  if (postsMap.size === 0) {
    showPostsNotFound({ name });
    return;
  }

  let movedCount = 0;
  let movedFailCount = 0;

  for (const [id, postData] of postsMap.entries()) {
    try {
      await Promise.all([
        apiFetch(`/v2/blog/${uuid}/posts/${id}`, {
          method: 'PUT',
          body: {
            ...createEditRequestBody(postData),
            state: 'draft'
          }
        }),
        sleep(1000)
      ]);
      movedCount++;
    } catch (exception) {
      console.error(exception);
      movedFailCount++;
    }
    toggleStatus.textContent = `Moved ${movedCount} posts... ${movedFailCount ? `(failed: ${movedFailCount})` : ''}`;
  }

  await sleep(1000);

  showModal({
    title: 'All done!',
    message: [
      `Moved ${movedCount} posts${movedFailCount ? ` (failed: ${movedFailCount})` : ''}.\n`
    ],
    buttons: [dom('button', null, { click: hideModal }, ['Close'])]
  });
};

const sidebarOptions = {
  id: 'queue-to-drafts',
  title: 'Queue to Drafts',
  rows: [{
    label: 'Move queue to drafts',
    onclick: showInitialPrompt,
    carrot: true
  }],
  visibility: () => /^\/blog\/[^/]+\/queue\/?$/.test(location.pathname)
};

export const main = async function () {
  addSidebarItem(sidebarOptions);
};
export const clean = async function () {
  removeSidebarItem(sidebarOptions.id);
};

export const stylesheet = true;
