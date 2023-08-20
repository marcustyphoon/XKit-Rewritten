import { createControlButtonTemplate, cloneControlButton } from '../../util/control_buttons.js';
import { keyToCss } from '../../util/css_map.js';
import { dom } from '../../util/dom.js';
import { filterPostElements, postSelector } from '../../util/interface.js';
import { showModal, hideModal, modalCancelButton } from '../../util/modals.js';
import { onNewPosts } from '../../util/mutations.js';
import { notify } from '../../util/notifications.js';
import { timelineObject } from '../../util/react_props.js';
import { apiFetch, createEditRequestBody } from '../../util/tumblr_helpers.js';

const debounce = (func, ms) => {
  let timeoutID;
  return (...args) => {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => func(...args), ms);
  };
};

const symbolId = 'ri-pencil-ruler-line';
const buttonClass = 'xkit-advanced-editor-button';

const controlIconSelector = keyToCss('controlIcon');

let controlButtonTemplate;

const onButtonClicked = async function ({ currentTarget: controlButton }) {
  const postElement = controlButton.closest(postSelector);
  const postId = postElement.dataset.id;

  const {
    blog: { uuid },
    isBlocksPostFormat
  } = await timelineObject(postElement);

  if (isBlocksPostFormat === false) {
    await new Promise(resolve => {
      showModal({
        title: 'Note: Legacy post',
        message: [
          'This thread was originally created, or at some point was edited, using the ',
          dom('strong', null, null, 'legacy post editor'),
          ' or a previous XKit version.'
        ],
        buttons: [
          modalCancelButton,
          dom('button', { class: 'blue' }, { click: resolve }, ['Continue'])
        ]
      });
    });
  }

  const { response: postData } = await apiFetch(
    `/v2/blog/${uuid}/posts/${postId}?fields[blogs]=name,avatar`
  );
  const { content = [] } = postData;

  const textarea = dom(
    'textarea',
    {
      style: `
        min-width: 476px;
        min-height: 300px;
        font-family: monospace;
        border-radius: 1px;
        background: RGB(var(--white));
        color: RGB(var(--black));
      `,
      // textarea cannot be focused without this if opened over the blog view modal
      'data-skip-glass-focus-trap': true
    },
    null,
    [JSON.stringify(content, null, 2)]
  );

  const getContent = () => {
    const content = JSON.parse(textarea.value);
    if (!Array.isArray(content)) throw new Error('Content must be an array');
    if (!content.every(block => typeof block.type === 'string')) {
      throw new Error('Content block is missing a type');
    }
    return content;
  };

  const onSubmit = async () => {
    let newContent = [];
    try {
      newContent = getContent();
    } catch (e) {
      alert('invalid JSON! try again');
      return;
    }

    hideModal();

    try {
      const {
        response: { displayText }
      } = await apiFetch(`/v2/blog/${uuid}/posts/${postId}`, {
        method: 'PUT',
        body: {
          ...createEditRequestBody(postData),
          content: newContent
        }
      });
      notify(displayText);
    } catch ({ body }) {
      notify(body.errors[0].detail);
    }
  };

  const submitButton = dom('button', { class: 'blue' }, { click: onSubmit }, ['Edit']);

  const checkValidity = () => {
    try {
      getContent();
      textarea.style.outline = '';
      submitButton.disabled = false;
    } catch (e) {
      textarea.style.outline = '5px solid rgb(255, 0, 0, 0.7)';
      submitButton.disabled = true;
    }
  };

  checkValidity();
  textarea.addEventListener('input', debounce(checkValidity, 100));

  showModal({
    title: 'Edit post content JSON',
    message: [textarea],
    buttons: [modalCancelButton, submitButton]
  });
};

const processPosts = postElements =>
  filterPostElements(postElements).forEach(async postElement => {
    const existingButton = postElement.querySelector(`.${buttonClass}`);
    if (existingButton !== null) {
      return;
    }

    const editButton = postElement.querySelector(
      `footer ${controlIconSelector} a[href*="/edit/"]`
    );
    if (!editButton) {
      return;
    }

    const clonedControlButton = cloneControlButton(controlButtonTemplate, {
      click: onButtonClicked
    });
    const controlIcon = editButton.closest(controlIconSelector);
    controlIcon.before(clonedControlButton);
  });

export const main = async function () {
  controlButtonTemplate = createControlButtonTemplate(symbolId, buttonClass);
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  $(`.${buttonClass}`).remove();
};

export const stylesheet = true;
