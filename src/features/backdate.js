import { createControlButtonTemplate, cloneControlButton } from '../utils/control_buttons.js';
import { keyToCss } from '../utils/css_map.js';
import { dom } from '../utils/dom.js';
import { filterPostElements, postSelector } from '../utils/interface.js';
import { showModal, hideModal, modalCancelButton, showErrorModal } from '../utils/modals.js';
import { onNewPosts } from '../utils/mutations.js';
import { notify } from '../utils/notifications.js';
import { timelineObject } from '../utils/react_props.js';
import { apiFetch, createEditRequestBody } from '../utils/tumblr_helpers.js';

const symbolId = 'ri-calendar-view';
const buttonClass = 'xkit-backdate-button';
const formId = 'xkit-backdate-form';

const controlIconSelector = keyToCss('controlIcon');

let controlButtonTemplate;

const timezoneOffsetMs = new Date().getTimezoneOffset() * 60000;

const createDateTimeString = (parsableString) => {
  const date = new Date(parsableString);

  const YYYY = `${date.getFullYear()}`.padStart(4, '0');
  const MM = `${date.getMonth() + 1}`.padStart(2, '0');
  const DD = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');

  return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
};

const onButtonClicked = async function ({ currentTarget: controlButton }) {
  const postElement = controlButton.closest(postSelector);
  const postId = postElement.dataset.id;

  const { blog: { uuid } } = await timelineObject(postElement);
  const { response: postData } = await apiFetch(`/v2/blog/${uuid}/posts/${postId}`);

  const onSubmit = async event => {
    event.preventDefault();
    hideModal();

    const { elements } = event.currentTarget;
    const newDate = new Date(elements.date.valueAsNumber + timezoneOffsetMs);

    try {
      const { response: { displayText } } = await apiFetch(`/v2/blog/${uuid}/posts/${postId}`, {
        method: 'PUT',
        body: {
          ...createEditRequestBody(postData),
          date: newDate.toISOString()
        }
      });
      notify(displayText);

      controlButton.remove();
    } catch (exception) {
      showErrorModal(exception);
    }
  };

  const form = dom('form', { id: formId }, { submit: onSubmit }, [
    dom('label', null, null, [
      'New date:',
      dom('input', { type: 'datetime-local', name: 'date', value: createDateTimeString(postData.date), required: true })
    ])
  ]);

  const editButton = dom('input', { class: 'blue', type: 'submit', form: formId, value: 'Edit!' });

  showModal({
    title: 'Change post date?',
    message: [form],
    buttons: [modalCancelButton, editButton]
  });
};

const processPosts = postElements => filterPostElements(postElements).forEach(async postElement => {
  const existingButton = postElement.querySelector(`.${buttonClass}`);
  if (existingButton !== null) { return; }

  const editIcon = postElement.querySelector(`footer ${controlIconSelector} a[href*="/edit/"] use[href="#managed-icon__edit"]`);
  if (!editIcon) { return; }
  const editButton = editIcon.closest('a');

  const clonedControlButton = cloneControlButton(controlButtonTemplate, { click: event => onButtonClicked(event).catch(showErrorModal) });
  const controlIcon = editButton.closest(controlIconSelector);
  controlIcon.before(clonedControlButton);
});

export const main = async function () {
  controlButtonTemplate = createControlButtonTemplate(symbolId, buttonClass, 'Edit Date');
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  $(`.${buttonClass}`).remove();
};
