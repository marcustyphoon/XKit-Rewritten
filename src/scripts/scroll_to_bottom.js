import { keyToClasses, keyToCss } from '../util/css_map.js';
import { translate } from '../util/language_data.js';
import { pageModifications } from '../util/mutations.js';
import { buildStyle } from '../util/interface.js';

const buttonClass = 'xkit-scroll-to-bottom-button';
$(`.${buttonClass}`).remove();
const activeClass = 'xkit-scroll-to-bottom-active';

const loaderSelector = `
${keyToCss('timeline', 'blogRows')} > :last-child,
${keyToCss('notifications')} + ${keyToCss('loader')}
`;
const knightRiderLoaderSelector = `:is(${loaderSelector}) > ${keyToCss('knightRiderLoader')}`;

const modalScrollContainerSelector = `${keyToCss('drawerContent')} > ${keyToCss('scrollContainer')}`;

let scrollToBottomButton;
let modalScrollToBottomButton;
let activeElement = false;

const styleElement = buildStyle(`
.${buttonClass} {
  margin-top: 0.5ch;
  transform: rotate(180deg);
}
.${buttonClass}.modal {
  margin-top: 1ch;
}

#base-container:has(> #glass-container ${modalScrollContainerSelector}) .${buttonClass}.normal {
  opacity: 0;
  pointer-events: none;
}

.${activeClass} svg use {
  --icon-color-primary: rgb(var(--yellow));
}
.${activeClass}.modal {
  background-color: rgb(var(--black)) !important;
}
`);

const getScrollElement = () =>
  document.querySelector(modalScrollContainerSelector) ||
  document.documentElement;

const getObserveElement = () =>
  document.querySelector(modalScrollContainerSelector)?.firstElementChild ||
  document.documentElement;

const scrollToBottom = () => {
  activeElement.scrollTo({ top: activeElement.scrollHeight });

  const loaders = [...activeElement.querySelectorAll(knightRiderLoaderSelector)];
  const buttonConnected = scrollToBottomButton?.isConnected || modalScrollToBottomButton?.isConnected;

  if (loaders.length === 0 || !buttonConnected || activeElement !== getScrollElement()) {
    stopScrolling();
  }
};
const observer = new ResizeObserver(scrollToBottom);

const startScrolling = () => {
  scrollToBottomButton?.classList.add(activeClass);
  modalScrollToBottomButton?.classList.add(activeClass);

  activeElement = getScrollElement();
  observer.observe(getObserveElement());
  scrollToBottom();
};

const stopScrolling = () => {
  observer.disconnect();
  activeElement = false;

  scrollToBottomButton?.classList.remove(activeClass);
  modalScrollToBottomButton?.classList.remove(activeClass);
};

const onClick = () => activeElement ? stopScrolling() : startScrolling();
const onKeyDown = ({ key }) => key === '.' && stopScrolling();

const cloneButton = (target, mode) => {
  const clonedButton = target.cloneNode(true);
  keyToClasses('hidden').forEach(className => clonedButton.classList.remove(className));
  clonedButton.removeAttribute('aria-label');
  clonedButton.addEventListener('click', onClick);
  clonedButton.classList.add(buttonClass, mode);

  clonedButton.classList[activeElement ? 'add' : 'remove'](activeClass);
  return clonedButton;
};

const addButtonToPage = async function ([scrollToTopButton]) {
  scrollToBottomButton ??= cloneButton(scrollToTopButton, 'normal');

  scrollToTopButton.after(scrollToBottomButton);
  scrollToTopButton.addEventListener('click', stopScrolling);
};

const modalButtonColorObserver = new MutationObserver(([mutation]) => {
  modalScrollToBottomButton.style = mutation.target.style.cssText;
});

const addModalButtonToPage = async function ([modalScrollToTopButton]) {
  modalScrollToBottomButton ??= cloneButton(modalScrollToTopButton, 'modal');

  modalScrollToTopButton.after(modalScrollToBottomButton);
  modalScrollToTopButton.addEventListener('click', stopScrolling);

  modalScrollToBottomButton.style = modalScrollToTopButton.style.cssText;
  modalButtonColorObserver.observe(modalScrollToTopButton, { attributeFilter: ['style'] });
};

export const main = async function () {
  pageModifications.register(`button[aria-label="${translate('Scroll to top')}"]`, addButtonToPage);
  pageModifications.register(`button[aria-label="${translate('Back to top')}"]`, addModalButtonToPage);
  document.documentElement.addEventListener('keydown', onKeyDown);

  document.documentElement.append(styleElement);
};

export const clean = async function () {
  stopScrolling();

  pageModifications.unregister(addButtonToPage);
  pageModifications.unregister(addModalButtonToPage);
  document.documentElement.removeEventListener('keydown', onKeyDown);

  styleElement.remove();

  scrollToBottomButton?.remove();
  modalScrollToBottomButton?.remove();
  modalButtonColorObserver.disconnect();
};
