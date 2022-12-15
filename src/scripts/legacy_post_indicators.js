import { keyToCss } from '../util/css_map.js';
import { dom } from '../util/dom.js';
import { buildStyle, filterPostElements } from '../util/interface.js';
import { onNewPosts } from '../util/mutations.js';
import { timelineObject } from '../util/react_props.js';

const indicatorClass = 'xkit-legacy-post-indicator';
const excludeClass = 'xkit-legacy-post-done';
const includeFiltered = true;

const styleElement = buildStyle(`
.xkit-legacy-post-indicator {
  align-self: center;

  font-weight: initial;
  color: rgba(var(--black), 0.65);
  cursor: help;
}
`);

let indicatorTemplate;

const processPosts = postElements =>
  filterPostElements(postElements, { excludeClass, includeFiltered }).forEach(
    async postElement => {
      const { isBlocksPostFormat } = await timelineObject(postElement);

      if (isBlocksPostFormat === false) {
        const rightContent = postElement.querySelector(`header ${keyToCss('rightContent')}`);
        if (!rightContent || rightContent.querySelector(keyToCss('sponsoredContainer'))) {
          return;
        }

        rightContent.before(indicatorTemplate.cloneNode(true));
      }
    }
  );

export const main = async function () {
  document.head.append(styleElement);
  indicatorTemplate = dom(
    'div',
    { class: indicatorClass, title: 'Stored in the legacy post format.' },
    null,
    ['legacy']
  );
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  styleElement.remove();
  $(`.${indicatorClass}`).remove();
};
