import { keyToCss } from '../../util/css_map.js';
import { dom } from '../../util/dom.js';
import { buildStyle } from '../../util/interface.js';
import { translate } from '../../util/language_data.js';

const followingHomeButton = `:is(li[title="${translate('Home')}"], button[aria-label="${translate('Home')}"], a[href="/dashboard/following"])`;

const titleSelector = 'title:not([data-xkit])';

const customTitleElement = dom('title', { 'data-xkit': true });
const styleElement = buildStyle(`
${followingHomeButton} ${keyToCss('notificationBadge')} {
  display: none;
}
`);

const updateTitle = titleElement => {
  const rawTitle = titleElement.textContent;
  const newTitle = rawTitle.replace(/^\(\d{1,2}\) /, '');
  customTitleElement.textContent = newTitle;
};

const observer = new MutationObserver(mutations =>
  mutations
    .flatMap(({ addedNodes }) => [...addedNodes])
    .filter(addedNode => addedNode instanceof Element && addedNode.matches(titleSelector))
    .forEach(updateTitle)
);

export const main = async () => {
  document.head.prepend(customTitleElement);
  document.documentElement.append(styleElement);

  observer.observe(document.head, { childList: true });
  updateTitle(document.head.querySelector(titleSelector));
};

export const clean = async () => {
  observer.disconnect();

  customTitleElement.remove();
  styleElement.remove();
};
