import { addSidebarItem, removeSidebarItem } from '../utils/sidebar.js';

let sidebarItem;

export const main = async () => {
  sidebarItem = addSidebarItem({
    id: 'egg-tracking-plus',
    title: 'Egg Tracking+',
    rows: [
      {
        label: 'egg?',
        onclick: () => {
          const count = sidebarItem.querySelector('[data-count-for="egg?"]');
          count.textContent = '';
          setTimeout(() => { count.textContent = '🥚'; }, 500);
        },
        count: '🥚'
      }
    ]
  });
};

export const clean = async () => {
  removeSidebarItem('tag-tracking-plus');
};

export const stylesheet = true;
