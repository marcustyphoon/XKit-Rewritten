import {
  createControlButtonTemplate,
  cloneControlButton,
  insertControlButton
} from '../../utils/control_buttons.js';
import { dom } from '../../utils/dom.js';
import { filterPostElements, postSelector } from '../../utils/interface.js';
import { showModal, modalCancelButton, showErrorModal } from '../../utils/modals.js';
import { onNewPosts } from '../../utils/mutations.js';
import { notify } from '../../utils/notifications.js';
import { timelineObject } from '../../utils/react_props.js';
import { apiFetch, createEditRequestBody } from '../../utils/tumblr_helpers.js';

const symbolId = 'ri-text-block';
const buttonClass = 'xkit-code-unbold-button';

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

  postData.content.forEach(block => {
    if (block.subtype === 'chat') {
      delete block.formatting;
    }
  });

  try {
    const {
      response: { displayText }
    } = await apiFetch(`/v2/blog/${uuid}/posts/${postId}`, {
      method: 'PUT',
      body: {
        ...createEditRequestBody(postData)
      }
    });
    notify(displayText);
  } catch (exception) {
    showErrorModal(exception);
  }
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
  controlButtonTemplate = createControlButtonTemplate(
    symbolId,
    buttonClass,
    'Unbold code blocks'
  );
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  $(`.${buttonClass}`).remove();
};
