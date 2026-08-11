import { keyToCss } from '../../utils/css_map.js';
import { buildStyle, getClosestRenderedElement, postSelector } from '../../utils/interface.js';
import { pageModifications } from '../../utils/mutations.js';

const containerAttribute = 'data-relocate-masonry-notes-container';
const backdropAttribute = 'data-relocate-masonry-notes-backdrop';

const styleElement = buildStyle();

const processNotifications = async ([notesPopover]) => {
  const container = notesPopover.closest('#glass-container > div');
  container.toggleAttribute(containerAttribute, true);

  const backdrop = container.previousElementSibling;
  backdrop.toggleAttribute(backdropAttribute, true);

  const postElement = await getClosestRenderedElement(notesPopover, postSelector);
  const { bottom, left, width } = postElement.getBoundingClientRect();

  const { scrollX, scrollY } = window;

  styleElement.textContent = `
    body {
      overflow-y: unset !important;
    }
    [${containerAttribute}] {
      top: ${bottom + scrollY}px !important;
      left: ${left + width / 2 + scrollX}px !important;
      transform: translate(-50%, 0) !important;
    }
    [${backdropAttribute}] {
      opacity: 0;
    }
  `;
  notesPopover.append(styleElement);

  // cancel tumblr's scrollIntoView if the popup now intersects the viewport bottom
  const onScroll = () => window.scrollTo(scrollX, scrollY);
  window.addEventListener('scroll', onScroll, { once: true });
  setTimeout(() => window.removeEventListener('scroll', onScroll), 500);
};

export const main = async function () {
  pageModifications.register(keyToCss('notesPopover'), processNotifications);
};

export const clean = async function () {
  pageModifications.unregister(processNotifications);

  $(`[${containerAttribute}]`).removeAttr(containerAttribute);
  $(`[${backdropAttribute}]`).removeAttr(backdropAttribute);
  styleElement.remove();
};
