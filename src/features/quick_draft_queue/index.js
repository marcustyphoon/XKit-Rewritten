import { cloneControlButton, createControlButtonTemplate, insertControlButton } from '../../utils/control_buttons.js';
import { keyToCss } from '../../utils/css_map.js';
import { inject } from '../../utils/inject.js';
import { filterPostElements } from '../../utils/interface.js';
import { showErrorModal } from '../../utils/modals.js';
import { onNewPosts } from '../../utils/mutations.js';
import { notify } from '../../utils/notifications.js';
import { timelineObject } from '../../utils/react_props.js';
import { anyDraftsTimelineFilter } from '../../utils/timeline_id.js';
import { apiFetch } from '../../utils/tumblr_helpers.js';

const symbolId = 'ri-time-line';
const buttonClass = 'xkit-quick-draft-queue-button';

let controlButtonTemplate;

const queueDraftPost = async function (postElement) {
  const { id, blog: { uuid } } = await timelineObject(postElement);

  await apiFetch(`/v2/blog/${uuid}/post/edit`, { method: 'POST', body: { id, state: 'queue' } });

  notify('Successfully queued draft post.');

  await inject('/main_world/remove_post.js', [id], postElement.closest(keyToCss('timeline')));
};

const processPosts = postElements => filterPostElements(postElements, { timeline: anyDraftsTimelineFilter }).forEach(async postElement => {
  const { state, canEdit } = await timelineObject(postElement);
  if (canEdit && state === 'draft') {
    const clonedControlButton = cloneControlButton(controlButtonTemplate, { click: event => queueDraftPost(postElement).catch(showErrorModal) });
    insertControlButton(postElement, clonedControlButton, buttonClass);
  }
});
export const main = async function () {
  controlButtonTemplate = createControlButtonTemplate(symbolId, buttonClass, 'Queue');
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  $(`.${buttonClass}`).remove();
};
