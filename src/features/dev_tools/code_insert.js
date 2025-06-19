import {
  createControlButtonTemplate,
  cloneControlButton,
  insertControlButton
} from '../../utils/control_buttons.js';
import { dom } from '../../utils/dom.js';
import { filterPostElements, postSelector } from '../../utils/interface.js';
import { showModal, hideModal, modalCancelButton, showErrorModal } from '../../utils/modals.js';
import { onNewPosts } from '../../utils/mutations.js';
import { notify } from '../../utils/notifications.js';
import { timelineObject } from '../../utils/react_props.js';
import { apiFetch, createEditRequestBody, navigate } from '../../utils/tumblr_helpers.js';

const symbolId = 'ri-code-block';
const buttonClass = 'xkit-code-insert-button';

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

  const codeElement = dom('textarea', {
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
  });

  const onSubmit = async () => {
    const newBlocks = [
      {
        type: 'text',
        text: '-'
      },
      {
        type: 'text',
        text: codeElement.value,
        subtype: 'chat'
      },
      {
        type: 'text',
        text: '-'
      }
    ];

    hideModal();

    try {
      const {
        response: { displayText }
      } = await apiFetch(`/v2/blog/${uuid}/posts/${postId}`, {
        method: 'PUT',
        body: {
          ...createEditRequestBody(postData),
          content: [...postData.content, ...newBlocks]
        }
      });
      notify(displayText);

      navigate(`/edit/${postData.blogName}/${postData.id}`);
    } catch (exception) {
      showErrorModal(exception);
    }
  };

  const submitButton = dom('button', { class: 'blue' }, { click: onSubmit }, ['Edit']);

  showModal({
    title: 'Insert code block',
    message: [codeElement],
    buttons: [modalCancelButton, submitButton]
  });
};

const processPosts = postElements =>
  filterPostElements(postElements).forEach(async postElement => {
    const { state, canEdit } = await timelineObject(postElement);

    if (canEdit && ['ask', 'submission'].includes(state) === false) {
      const clonedControlButton = cloneControlButton(controlButtonTemplate, {
        click: event => onButtonClicked(event).catch(showErrorModal)
      });
      insertControlButton(postElement, clonedControlButton, buttonClass);
    }
  });

export const main = async function () {
  controlButtonTemplate = createControlButtonTemplate(symbolId, buttonClass, 'Add code block');
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  $(`.${buttonClass}`).remove();
};
