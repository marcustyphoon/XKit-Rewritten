import { keyToCss } from '../../utils/css_map.js';
import { dom } from '../../utils/dom.js';
import { buildStyle, filterPostElements } from '../../utils/interface.js';
import { translate } from '../../utils/language_data.js';
import { onNewPosts } from '../../utils/mutations.js';
import { timelineObject } from '../../utils/react_props.js';

const buttonClass = 'xkit-note-count-button';
const footerContentSelector = `${keyToCss('footerContent')}:has(> .${buttonClass})`;

const shareSelector = 'div > :is(span, div, button):has(use[href="#managed-icon__ds-ui-upload-24"])';
const replySelector = `${keyToCss('engagementControls')} > :is(span, div, button):has(use[href="#managed-icon__ds-reply-outline-24"])`;
const reblogSelector = `${keyToCss('engagementControls')} > :is(span, div, button):has(use[href="#managed-icon__ds-reblog-24"])`;
const likeSelector = `${keyToCss('engagementControls')} > :is(span, div, button):has(use[href="#managed-icon__ds-like-outline-24"])`;

export const styleElement = buildStyle(`
  /* Create simple flexbox layout */
  ${footerContentSelector} > div {
    display: contents;
  }
  ${footerContentSelector} {
    gap: 0;
    padding: 12px;
  }
  ${footerContentSelector} > ${keyToCss('engagementControls')} > :is(span, div, button) {
    flex: 0;
  }

  /* Remove individual note counts */
  ${footerContentSelector} ${keyToCss('engagementCount')} {
    display: none;
  }
  ${footerContentSelector} ${keyToCss('engagementAction')} + button${keyToCss('engagementCount')} {
    display: none;
  }

  /* Feature-added note count button */
  .${buttonClass} {
    order: -20;
    height: 36px;
    padding: 6px 16px;
    margin-right: auto;

    border: 1px solid rgba(var(--black), .15);
    border-radius: 18px;
  }
  .${buttonClass} > span {
    font-weight: 700;
  }

  /* Arrange existing buttons */
  ${footerContentSelector} ${keyToCss('blazeControl')} {
    position: unset;
    order: -1;
  }
  ${footerContentSelector} > ${shareSelector} {
    order: 1;
  }
  ${footerContentSelector} > ${replySelector} {
    order: 2;
  }
  ${footerContentSelector} > ${reblogSelector} {
    order: 3;
  }
  ${footerContentSelector} > ${likeSelector} {
    order: 4;
  }


  /* Optional blaze button divider */
  ${footerContentSelector}:has(${keyToCss('blazeControl')})::after {
    display: block;
    width: 1px;
    height: 1.2em;
    margin: 4px;

    content: '';
    background-color: rgba(var(--black), 0.13);
  }
`);

const singleActionFooterContentSelector = `${keyToCss('postFooter')} > ${keyToCss('footerContent')}:has(> ${keyToCss('engagementControls')} > button${keyToCss('engagementAction')})`;

const processPosts = async function (postElements) {
  filterPostElements(postElements).forEach(async postElement => {
    const { noteCount, state, community } = await timelineObject(postElement);
    if (state !== 'published') return;
    if (community) return;

    // this feature needs the "tabs2025" element to exist so the user can change between replies/reblogs/likes
    // from within the expanded footer. only the "single action" footer variant has this.
    const footerContent = postElement.querySelector(singleActionFooterContentSelector);

    footerContent?.prepend(
      dom(
        'button',
        { class: buttonClass },
        {
          click: () =>
            footerContent
              .querySelector('button:has(use[href="#managed-icon__ds-reply-outline-24"])')
              ?.click()
        },
        [
          dom('span', null, null, [new Intl.NumberFormat().format(noteCount)]), // todo: localize
            ` ${translate('notes')}` // should ideally be singular when count is one
        ]
      )
    );
  });
};

export const main = async () => {
  onNewPosts.addListener(processPosts);
};

export const clean = async () => {
  onNewPosts.removeListener(processPosts);

  $(`.${buttonClass}`).remove();
};
