import { keyToCss } from '../../utils/css_map.js';
import { dom } from '../../utils/dom.js';
import { buildStyle, filterPostElements, postSelector } from '../../utils/interface.js';
import { modalCancelButton, showErrorModal, showModal } from '../../utils/modals.js';
import { onNewPosts } from '../../utils/mutations.js';
import { notify } from '../../utils/notifications.js';
import { timelineObject } from '../../utils/react_props.js';
import { buildSvg } from '../../utils/remixicon.js';
import { apiFetch, createEditRequestBody } from '../../utils/tumblr_helpers.js';

const symbolId = 'ri-pencil-line';
const buttonClass = 'xkit-link-editor-button';
const buttonLabel = 'Edit link';

export const styleElement = buildStyle(`
a:has(> .${buttonClass}) {
  position: relative;
}
.${buttonClass} {
  position: absolute;
  bottom: 0.5em;
  right: 0.5em;

  isolation: isolate;
}
`);

const onButtonClicked = async function (event) {
  event.preventDefault();
  // event.stopPropagation();
  const { currentTarget: controlButton } = event;
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

  // hm. turns out it's basically impossible to figure out which link elements correspond to what post data
  // (even which are part of the editable trail item is hard)

  showModal({
    title: 'title',
    message: 'message',
    buttons: [modalCancelButton]
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
  filterPostElements(postElements).forEach(postElement => {
    const editButton = postElement.querySelector(
      `footer ${keyToCss('controlIcon')} a[href*="/edit/"]`
    );
    if (!editButton) {
      return;
    }
    [...postElement.querySelectorAll(`${keyToCss('linkCard')} > a`)].forEach(linkElement => {
      if (!linkElement.querySelector(`.${buttonClass}`)) {
        const button = dom(
          'button',
          { class: `${buttonClass} xkit-control-button-inner`, 'aria-label': buttonLabel, title: buttonLabel },
          { click: onButtonClicked },
          [buildSvg(symbolId)]
        );
        linkElement.append(button);
      }
    });
  });

export const main = async () => {
  onNewPosts.addListener(processPosts);
};

export const clean = async () => {
  onNewPosts.removeListener(processPosts);
  $(`.${buttonClass}`).remove();
};
