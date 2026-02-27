import { createControlButtonTemplate, cloneControlButton, insertControlButton } from '../../utils/control_buttons.js';
import { dom, form, input, label } from '../../utils/dom.js';
import { filterPostElements, postSelector } from '../../utils/interface.js';
import { showModal, hideModal, modalCancelButton, showErrorModal } from '../../utils/modals.js';
import { onNewPosts } from '../../utils/mutations.js';
import { notify } from '../../utils/notifications.js';
import { timelineObject, updatePostOnPage } from '../../utils/react_props.js';
import { apiFetch, createEditRequestBody } from '../../utils/tumblr_helpers.js';

const symbolId = 'ri-link-unlink-m';
const buttonClass = 'xkit-link-card-editor-button';

let controlButtonTemplate;

const onButtonClicked = async function ({ currentTarget: controlButton }) {
  const postElement = controlButton.closest(postSelector);
  const postId = postElement.dataset.id;

  const {
    blog: { uuid },
  } = await timelineObject(postElement);

  const { response: postData } = await apiFetch(`/v2/blog/${uuid}/posts/${postId}?fields[blogs]=name,avatar`);
  const { content = [], isBlocksPostFormat } = postData;

  if (isBlocksPostFormat === false) {
    await new Promise(resolve => {
      showModal({
        title: 'Note: Legacy post',
        message: [
          'This thread was originally created, or at some point was edited, using the ',
          dom('strong', null, null, 'legacy post editor'),
          ' or a previous XKit version.',
        ],
        buttons: [
          modalCancelButton,
          dom('button', { class: 'blue' }, { click: resolve }, ['Continue']),
        ],
      });
    });
  }

  const mutateFunctions = [];

  const textControlLabels = {
    url: 'URL (required):',
    title: 'Title:',
    description: 'Description:',
    siteName: 'Attribution Site Name:',
    author: 'Attribution Author Text:',
  };
  const textControlKeys = Object.keys(textControlLabels);

  const formElements = content.filter(({ type }) => type === 'link').map((linkBlock, i) => {
    const textControls = textControlKeys.map(type => ({
      type,
      inputElement: input({ type: 'text', value: linkBlock[type] ?? '' }),
    }));
    // const posterInputElement = input({ type: 'checkbox', checked: true });
    const posterInputElement = input({ type: 'text', value: linkBlock.poster ? JSON.stringify(linkBlock.poster) : '' });

    mutateFunctions.push(() => {
      textControls.forEach(({ type, inputElement }) => {
        if (linkBlock[type] && !inputElement.value) {
          delete linkBlock[type];
        }
        if (inputElement.value) {
          linkBlock[type] = inputElement.value;
        }
      });
      // if (!posterInputElement.checked) {
      //   delete linkBlock.poster;
      // }
      if (posterInputElement.value) {
        const poster = JSON.parse(posterInputElement.value);
        if (poster && Array.isArray(poster) && poster.length) {
          linkBlock.poster = poster;
        } else {
          throw new Error();
        }
      } else {
        delete linkBlock.poster;
      }
      delete linkBlock.displayUrl;
    });

    return form(i > 0 ? { style: 'margin-top: 0.5em;' } : {}, [
      ...textControls.map(({ type, inputElement }) => label({}, [textControlLabels[type], inputElement])),
      // ...linkBlock.poster ? [label({}, ['Keep Poster Image', posterInputElement])] : [],
      label({}, ['Poster Data (JSON array):', posterInputElement]),
    ]);
  });

  const onClickSubmit = async () => {
    try {
      mutateFunctions.forEach(func => func());
    } catch (exception) {
      alert('Error processing form.');
      return;
    }

    hideModal();

    try {
      const { response: { displayText } } = await apiFetch(`/v2/blog/${uuid}/posts/${postId}`, {
        method: 'PUT',
        body: {
          ...createEditRequestBody(postData),
          content,
        },
      });
      notify(displayText);
      await updatePostOnPage(postElement, ['content']);
    } catch (exception) {
      showErrorModal(exception);
    }
  };

  const submitButton = dom('button', { class: 'blue' }, { click: onClickSubmit }, ['Edit']);

  showModal({
    title: 'Edit link cards',
    message: [...formElements],
    buttons: [modalCancelButton, submitButton],
  });
};

const processPosts = postElements => filterPostElements(postElements).forEach(async postElement => {
  const { state, canEdit, content = [] } = await timelineObject(postElement);

  if (canEdit && content.some(({ type }) => type === 'link') && ['ask', 'submission'].includes(state) === false) {
    const clonedControlButton = cloneControlButton(controlButtonTemplate, { click: event => onButtonClicked(event).catch(showErrorModal) });
    insertControlButton(postElement, clonedControlButton, buttonClass);
  }
});

export const main = async function () {
  controlButtonTemplate = createControlButtonTemplate(symbolId, buttonClass, 'Edit Link Cards');
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  $(`.${buttonClass}`).remove();
};

export const stylesheet = true;
