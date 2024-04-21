import { modalCompleteButton, showErrorModal, showModal } from '../../util/modals.js';
import { addSidebarItem, removeSidebarItem } from '../../util/sidebar.js';
import { apiFetch } from '../../util/tumblr_helpers.js';

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
