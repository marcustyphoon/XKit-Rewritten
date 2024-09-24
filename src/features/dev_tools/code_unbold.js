import {
  createControlButtonTemplate,
  cloneControlButton
} from '../../utils/control_buttons.js';
import { keyToCss } from '../../utils/css_map.js';
import { dom } from '../../utils/dom.js';
import { filterPostElements, postSelector } from '../../utils/interface.js';
import { showModal, modalCancelButton, showErrorModal } from '../../utils/modals.js';
import { onNewPosts } from '../../utils/mutations.js';
import { notify } from '../../utils/notifications.js';
import { timelineObject } from '../../utils/react_props.js';
import { apiFetch, createEditRequestBody } from '../../utils/tumblr_helpers.js';

const symbolId = 'ri-text-block';
const buttonClass = 'xkit-code-unbold-button';

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

    const { content } = await timelineObject(postElement);

    if (!content.some(block => block.subtype === 'chat' && block.formatting)) return;

    const clonedControlButton = cloneControlButton(controlButtonTemplate, {
      click: event => onButtonClicked(event).catch(showErrorModal)
    });
    const controlIcon = editButton.closest(controlIconSelector);
    controlIcon.before(clonedControlButton);
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
