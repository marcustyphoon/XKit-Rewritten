import { createControlButtonTemplate, cloneControlButton, insertControlButton } from '../../utils/control_buttons.js';
import { dom } from '../../utils/dom.js';
import { filterPostElements, postSelector } from '../../utils/interface.js';
import { showModal, hideModal, modalCancelButton, showErrorModal } from '../../utils/modals.js';
import { onNewPosts } from '../../utils/mutations.js';
import { notify } from '../../utils/notifications.js';
import { timelineObject } from '../../utils/react_props.js';
import { apiFetch, createEditRequestBody } from '../../utils/tumblr_helpers.js';
import hljs from '../../lib/highlight.js/core.min.js';
import json from '../../lib/highlight.js/json.min.js';

hljs.registerLanguage('json', json);

const highlightStyleElement = dom('link', {
  rel: 'stylesheet',
  href: browser.runtime.getURL('/lib/highlight.js/vs2015.min.css')
});

const debounce = (func, ms) => {
  let timeoutID;
  return (...args) => {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => func(...args), ms);
  };
};

const symbolId = 'ri-braces-line';
const buttonClass = 'xkit-json-editor-button';

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

  const codeElement = dom(
    'code',
    {
      contenteditable: true,
      class: 'language-json',
      style: `
        min-width: 476px;
        min-height: 300px;
        max-height: 80vh;

        font-size: 1rem;
        text-align: start;
        white-space: pre-wrap;
      `,
      // textarea cannot be focused without this if opened over the blog view modal
      'data-skip-glass-focus-trap': true
    },
    null,
    [JSON.stringify(content, null, 2)]
  );
  const preElement = dom('pre', null, null, [codeElement]);

  const formatContent = () => {
    try {
      codeElement.textContent = JSON.stringify(JSON.parse(codeElement.textContent), null, 2);
    } catch (e) {}

    try {
      delete codeElement.dataset.highlighted;
      hljs.highlightElement(codeElement);
    } catch (e) {}
  };

  formatContent();
  const formatButton = dom('button', null, { click: formatContent }, ['Format JSON']);

  const getContent = () => {
    const content = JSON.parse(codeElement.textContent);
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
    } catch (exception) {
      showErrorModal(exception);
    }
  };

  const submitButton = dom('button', { class: 'blue' }, { click: onSubmit }, ['Edit']);

  const checkValidity = () => {
    try {
      getContent();
      preElement.style.outline = '';
      submitButton.disabled = false;
    } catch (e) {
      preElement.style.outline = '5px solid rgb(255, 0, 0, 0.7)';
      submitButton.disabled = true;
    }
  };

  checkValidity();
  preElement.addEventListener('input', debounce(checkValidity, 100));

  const cancelButton = dom('button', { class: 'red' }, { click: hideModal }, ['Cancel']);

  showModal({
    title: 'Edit post content JSON',
    message: [preElement],
    buttons: [cancelButton, formatButton, submitButton]
  });

  preElement.parentElement.style.maxWidth = '80vw';
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
  controlButtonTemplate = createControlButtonTemplate(symbolId, buttonClass, 'Edit JSON');
  document.documentElement.append(highlightStyleElement);
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  highlightStyleElement.remove();
  $(`.${buttonClass}`).remove();
};

export const stylesheet = true;
