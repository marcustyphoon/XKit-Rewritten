import { keyToClasses } from '../../util/css_map.js';
import { onNewPosts } from '../../util/mutations.js';
import { buildStyle } from '../../util/interface.js';

const excludeClass = 'xkit-notes-hidden-done';
const replacementClass = 'xkit-notes-hidden-replacement';
const styleElement = buildStyle(`.${replacementClass} + span { display: none; }`);

let containerSelector;

const hideNotes = async function () {
  [...document.querySelectorAll(containerSelector)]
    .forEach(element => {
      element.classList.add(excludeClass);
      const noteElement = element.querySelector('span');
      if (!noteElement) return;

      const replacement = noteElement.cloneNode();
      replacement.classList.add(replacementClass);

      const textWithoutCount = noteElement.innerText
        .replace(/^[\d,.\s]*/, '')
        .replace(/[\d,.\s]+개$/, '');
      replacement.innerText = textWithoutCount;

      noteElement.before(replacement);
    });
};

export const main = async function () {
  const noteCountContainerClasses = await keyToClasses('noteCountContainer');
  containerSelector = noteCountContainerClasses
    .map(className => `.${className}:not(.${excludeClass})`)
    .join(', ');

  onNewPosts.addListener(hideNotes);
  hideNotes();

  document.head.append(styleElement);
};

export const clean = async function () {
  onNewPosts.removeListener(hideNotes);
  styleElement.remove();

  $(`.${excludeClass}`).removeClass(excludeClass);
  $(`.${replacementClass}`).remove();
};
