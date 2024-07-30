import { modalCompleteButton, showErrorModal, showModal } from '../../utils/modals.js';
import { addSidebarItem, removeSidebarItem } from '../../utils/sidebar.js';
import { apiFetch } from '../../utils/tumblr_helpers.js';

const doIt = async () => {
  console.log(await apiFetch('/v2/user/likes'));
};

const sidebarOptions = {
  id: 'test',
  title: 'Test',
  rows: [
    {
      label: 'Do it',
      onclick: () =>
        doIt()
          .then(() =>
            showModal({
              title: 'ok',
              buttons: [modalCompleteButton]
            })
          )
          .catch(showErrorModal),
      carrot: true
    }
  ]
};

export const main = async () => {
  addSidebarItem(sidebarOptions);
};

export const clean = async () => {
  removeSidebarItem(sidebarOptions.id);
};
