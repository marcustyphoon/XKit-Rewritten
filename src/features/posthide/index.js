import { getTimelineItemWrapper, filterPostElements } from '../../utils/interface.js';
import { registerMeatballItem, unregisterMeatballItem } from '../../utils/meatballs.js';
import { showModal, hideModal, modalCancelButton } from '../../utils/modals.js';
import { timelineObject } from '../../utils/react_props.js';
import { onNewPosts, pageModifications } from '../../utils/mutations.js';
import { dom } from '../../utils/dom.js';

const meatballButtonId = 'posthide';
const meatballButtonLabel = 'Hide this post';
const hiddenAttribute = 'data-posthide-hidden';

let hiddenPostRootIDs = [];

const processPosts = postElements =>
  filterPostElements(postElements, { includeFiltered: true }).forEach(async postElement => {
    const postID = postElement.dataset.id;
    const { rebloggedRootId } = await timelineObject(postElement);

    const rootID = rebloggedRootId || postID;

    if (hiddenPostRootIDs.includes(rootID)) {
      getTimelineItemWrapper(postElement).setAttribute(hiddenAttribute, '');
    } else {
      getTimelineItemWrapper(postElement).removeAttribute(hiddenAttribute);
    }
  });

const onButtonClicked = ({ currentTarget }) => {
  const { id, rebloggedRootId } = currentTarget.__timelineObjectData;
  const rootID = rebloggedRootId || id;

  showModal({
    title: 'Hide this post?',
    message: [
      'All instances of this post (including reblogs) will be hidden until you refresh the page.'
    ],
    buttons: [
      modalCancelButton,
      dom('button', { class: 'blue' }, { click: () => hidePost(rootID) }, ['Hide this post'])
    ]
  });
};

const hidePost = async rootID => {
  hideModal();
  hiddenPostRootIDs.push(rootID);
  pageModifications.trigger(processPosts);
};

export const main = async function () {
  registerMeatballItem({ id: meatballButtonId, label: meatballButtonLabel, onclick: onButtonClicked });

  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  unregisterMeatballItem(meatballButtonId);
  onNewPosts.removeListener(processPosts);

  $(`[${hiddenAttribute}]`).removeAttr(hiddenAttribute);

  hiddenPostRootIDs = [];
};

export const stylesheet = true;
