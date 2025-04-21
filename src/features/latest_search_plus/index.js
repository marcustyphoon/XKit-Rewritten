import { keyToCss } from '../../utils/css_map.js';
import { dom } from '../../utils/dom.js';
import { buildStyle, postSelector } from '../../utils/interface.js';
import { hideModal, showModal } from '../../utils/modals.js';
import { pageModifications } from '../../utils/mutations.js';
import { addSidebarItem, removeSidebarItem } from '../../utils/sidebar.js';
import { navigate } from '../../utils/tumblr_helpers.js';

const activeClass = 'xkit-latest-search-plus-active';

export const styleElement = buildStyle(`
.${activeClass} {
  display: flex;
  flex-direction: column;
}

.${activeClass} > div {
  position: unset !important;
}
`);

const performSearch = async duration => {
  const searchTermEncoded = location.pathname.split('/')[2];
  const searchTerm = decodeURIComponent(searchTermEncoded);

  if (
    location.pathname === `/search/${searchTermEncoded}` &&
    new URLSearchParams(location.search).get('t') === String(duration)
  ) {
    return;
  }

  navigate(`/search/${searchTermEncoded}?t=${duration}`);

  const scrollContainerSelector = `[data-timeline-id^="searchTimeline-post-${searchTerm}-top-${duration}-"] ${keyToCss('scrollContainer')}`;
  await new Promise((resolve, reject) => {
    pageModifications.register(
      `${scrollContainerSelector} ${postSelector}`,
      resolve
    );
    setTimeout(() => reject(new Error('could not find timeline scroll container!')), 2000);
  });

  await scrollToBottomOnce();

  const scrollContainer = document.querySelector(scrollContainerSelector);
  scrollContainer.classList.add(activeClass);

  const postElements = [...scrollContainer.querySelectorAll('[data-cell-id*="post-"]')];
  const arr = postElements.map(el => el.dataset.cellId.replace(/.*post-/, '')).toSorted();
  postElements.forEach(el => {
    el.style.order = -1 - arr.indexOf(el.dataset.cellId.replace(/.*post-/, ''));
  });

  window.scrollTo({ top: 0 });
};

const scrollToBottomOnce = () => new Promise(resolve => {
  const loaderSelector = `
  ${keyToCss('timeline', 'blogRows')} > :is(${keyToCss('scrollContainer')}, .sortableContainer) + div,
  ${keyToCss('notifications')} + div
  `;
  const knightRiderLoaderSelector = `:is(${loaderSelector}) > ${keyToCss('knightRiderLoader')}`;

  let timeoutID;

  const scrollToBottom = () => {
    clearTimeout(timeoutID);
    window.scrollTo({ top: document.documentElement.scrollHeight });

    timeoutID = setTimeout(() => {
      if (!document.querySelector(knightRiderLoaderSelector)) {
        stopScrolling();
        resolve();
      }
    }, 500);
  };
  const observer = new ResizeObserver(scrollToBottom);

  const startScrolling = () => {
    observer.observe(document.documentElement);
    scrollToBottom();
  };

  const stopScrolling = () => {
    clearTimeout(timeoutID);
    observer.disconnect();
    hideModal();
  };

  showModal({
    title: 'Loading "top" posts...',
    message: ['Please wait!'],
    buttons: [
      dom(
        'button',
        { class: 'red' },
        { click: stopScrolling },
        ['Cancel!']
      )
    ]
  });
  startScrolling();
});

const sidebarOptions = {
  id: 'latest-search-plus',
  title: 'Latest Search Plus',
  rows: [
    {
      label: 'Show last day',
      onclick: () => performSearch(1),
      carrot: true
    },
    {
      label: 'Show last three days',
      onclick: () => performSearch(3),
      carrot: true
    },
    {
      label: 'Show last week',
      onclick: () => performSearch(7),
      carrot: true
    },
    {
      label: 'Show last month',
      onclick: () => performSearch(30),
      carrot: true
    }
  ],
  visibility: () => /^\/search\/[^/]+/.test(location.pathname)
};

const stopBuggyScroll = event => {
  if (['KeyJ', 'KeyK'].includes(event.code) && document.querySelector(`.${activeClass}`)) {
    event.stopPropagation();
  }
};

export const main = async function () {
  addSidebarItem(sidebarOptions);
  document.body.addEventListener('keydown', stopBuggyScroll);
};

export const clean = async function () {
  removeSidebarItem(sidebarOptions.id);
  document.body.removeEventListener('keydown', stopBuggyScroll);

  $(`.${activeClass}`).removeClass(activeClass);
};
