import { createControlButtonTemplate, cloneControlButton } from '../utils/control_buttons.js';
import { keyToCss } from '../utils/css_map.js';
import { dom } from '../utils/dom.js';
import { filterPostElements, postSelector } from '../utils/interface.js';
import { showModal, modalCancelButton, hideModal, showErrorModal } from '../utils/modals.js';
import { onNewPosts } from '../utils/mutations.js';
import { timelineObject } from '../utils/react_props.js';
import { apiFetch, navigate } from '../utils/tumblr_helpers.js';
import { primaryBlogName } from '../utils/user.js';

const symbolId = 'ri-edit-box-line';
const buttonClass = 'xkit-editable-reblogs-button';

const controlIconSelector = keyToCss('controlIcon');

let controlButtonTemplate;

const TOTAL_CONTENT_BLOCKS_LIMIT = 1000;
const SPECIFIC_LIMITS = {
  link: 10,
  image: 30,
  video: 10,
  audio: 10
};

// unsupported: 'paywall'
const supportedContentTypes = ['text', 'image', 'link', 'audio', 'video'];

const createFallbackContent = (type, label) => {
  const text = `[${label} ${type} block]`;
  return {
    type: 'text',
    text,
    formatting: [{ type: 'color', start: 0, end: text.length, hex: '#ff4930' }]
  };
};

const isValidRowsLayout = ({ type, display }, layout, content) => {
  if (type !== 'rows') return false;

  if (!Array.isArray(display)) {
    console.error('Invalid block layout!', layout, content);
    return false;
  }

  const allReferencedIndexes = display.flatMap(({ blocks }) => blocks).sort();
  const valid =
    allReferencedIndexes.length === content.length &&
    allReferencedIndexes.every((value, index) => value === index);

  if (!valid) {
    console.error('Invalid block layout!', layout, content);
    return false;
  }

  // dunno how to test this
  const hasCarousel = display.some(({ mode }) => mode?.type === 'carousel');
  if (hasCarousel) {
    console.error('Block has carousel!', layout, content);
    return false;
  }
  return true;
};

const createFallbackLayout = content => ({
  type: 'rows',
  display: content.map((value, index) => ({ blocks: [index] }))
});

// currently supported layout block types: 'rows', 'ask'
const processTrailItem = ({ blog, brokenBlog, content: inputContent = [], layout = [] }) => {
  const blogName = blog?.name ?? brokenBlog?.name;
  const content = inputContent.map(block => {
    if (!supportedContentTypes.includes(block.type)) {
      return createFallbackContent(block.type, 'unsupported');
    }
    if (['video', 'audio'].includes(block.type) && block.provider === 'tumblr') {
      return createFallbackContent(block.type, 'unsupported');
    }
    return block;
  });

  const rowsLayout =
    layout.find(object => isValidRowsLayout(object, layout, content)) ??
    createFallbackLayout(content);

  // display-data-with-embedded-content
  const data = rowsLayout.display.map(({ blocks }) => {
    const contentArray = blocks.map(i => content[i]);
    return { blocks: contentArray };
  });

  const askLayout = layout.find(({ type }) => type === 'ask');
  if (askLayout) {
    const askingBlog =
      askLayout.attribution?.blog?.name ??
      askLayout.attribution?.brokenBlog?.name;

    const createLabel = text => ({
      type: 'text',
      text,
      formatting: [{ type: 'bold', start: 0, end: text.length }]
    });

    const askLabel = createLabel(`${askingBlog ?? 'anonymous'} asked:`);
    const answerLabel = createLabel(`${blogName ?? 'anonymous'} answered:`);

    data.splice(0, 0, { blocks: [askLabel] });

    // incremented due to previous splice
    const lastIndexInAsk = Math.max(...askLayout.blocks) + 1;

    data.splice(lastIndexInAsk + 1, 0, { blocks: [answerLabel] });
  }
  return data;
};

const trailToNPF = (trailInput, skipTrailItems = 0) => {
  if (trailInput.length === skipTrailItems) {
    throw new Error('Post is too large');
  }
  const trail = JSON.parse(JSON.stringify(trailInput.slice(skipTrailItems)));

  // display-data-with-embedded-content
  const data = trail.flatMap(trailItem => {
    const { blog, brokenBlog, post } = trailItem;
    const blogName = blog?.name ?? brokenBlog?.name;

    const headerText = `${blogName ?? 'anonymous'}:`;
    const headerLabel = {
      type: 'text',
      subtype: 'heading2',
      text: headerText,
      formatting: [
        { type: 'bold', start: 0, end: headerText.length },
        {
          type: 'link',
          start: 0,
          end: headerText.length - 1,
          url: blogName && post?.id ? `tumblr.com/${blogName}/${post.id}` : ''
        }
      ]
    };
    const footerLabel = { type: 'text', text: '-------------------------------------' };

    return [
      { blocks: [headerLabel] },
      ...processTrailItem(trailItem),
      { blocks: [footerLabel] }
    ];
  });

  const totalBlockCount = data.reduce((prev, cur) => prev + cur.blocks.length, 0);
  if (totalBlockCount > TOTAL_CONTENT_BLOCKS_LIMIT) {
    return trailToNPF(trailInput, skipTrailItems + 1);
  }

  const enforceBlockTypeLimit = (typeToCheck, limit) => {
    const blocksOfType = data.reduce(
      (prev, cur) => prev + cur.blocks.filter(({ type }) => type === typeToCheck).length,
      0
    );
    if (blocksOfType > limit) {
      const firstObjectWithType = data.find(({ blocks }) =>
        blocks.some(({ type }) => type === typeToCheck)
      );
      firstObjectWithType.blocks = [createFallbackContent(typeToCheck, 'removed')];
      enforceBlockTypeLimit(typeToCheck, limit);
    }
  };

  Object.entries(SPECIFIC_LIMITS).forEach(([typeToCheck, limit]) =>
    enforceBlockTypeLimit(typeToCheck, limit)
  );

  // convert display-data-with-embedded content back to layout and content
  const newContent = [];
  const newDisplay = data.map(({ blocks: contentArray }) => {
    const idsArray = contentArray.map(contentItem => {
      newContent.push(contentItem);
      return newContent.length - 1;
    });
    return { blocks: idsArray };
  });
  const newLayout = [
    {
      type: 'rows',
      display: newDisplay
    }
  ];

  return { newContent, newLayout };
};

const onButtonClicked = async function ({ currentTarget: controlButton }) {
  // TODO: blog selection
  const targetBlog = primaryBlogName;

  const postElement = controlButton.closest(postSelector);

  const {
    rebloggedRootUuid,
    rebloggedRootId,
    blog,
    id,
    reblogKey,
    timestamp,
    content = [],
    layout,
    trail = [],
    shouldOpenInLegacy
  } = await timelineObject(postElement);

  try {
    const rootShouldOpenInLegacy =
      rebloggedRootUuid && rebloggedRootId
        ? (await apiFetch(`/v2/blog/${rebloggedRootUuid}/posts/${rebloggedRootId}`)).response
            .shouldOpenInLegacy
        : shouldOpenInLegacy;

    if (rootShouldOpenInLegacy) {
      await new Promise(resolve => {
        showModal({
          title: 'Note: Legacy post',
          message: [
            'The root post of this thread was originally created with the legacy post editor.',
            '\n\n',
            'On these threads, Editable Reblogs may work normally, have no effect, or require use of Trim Reblogs to completely remove the extra trail items.'
          ],
          buttons: [
            modalCancelButton,
            dom('button', { class: 'blue' }, { click: () => resolve() }, ['Continue'])
          ]
        });
      });
    }
  } catch (exception) {
    await new Promise(resolve => {
      showModal({
        title: 'Note: Possible legacy post',
        message: [
          'The root post of this thread may have been originally created with the legacy post editor.',
          '\n\n',
          'On these threads, Editable Reblogs may work normally, have no effect, or require use of Trim Reblogs to completely remove the extra trail items.'
        ],
        buttons: [
          modalCancelButton,
          dom('button', { class: 'blue' }, { click: () => resolve() }, ['Continue'])
        ]
      });
    });
  }

  const newTrailItem =
    content && content.length ? [{ blog, content, layout, post: { id, timestamp } }] : [];

  const trailWithNew = [...trail, ...newTrailItem];

  const { newContent, newLayout } = trailToNPF(trailWithNew);

  const excludeTrailItems = [...trailWithNew.keys()];

  const requestPath = `/v2/blog/${targetBlog}/posts`;
  const requestBody = {
    content: newContent,
    layout: newLayout,
    exclude_trail_items: excludeTrailItems,
    parent_post_id: id,
    parent_tumblelog_uuid: blog.uuid,
    reblog_key: reblogKey,
    state: 'draft'
  };

  const { response: { id: responseId } } = await apiFetch(requestPath, { method: 'POST', body: requestBody });

  hideModal();
  navigate(`/edit/${targetBlog}/${responseId}`);
};

const processPosts = postElements =>
  filterPostElements(postElements).forEach(async postElement => {
    const existingButton = postElement.querySelector(`.${buttonClass}`);
    if (existingButton !== null) { return; }

    const reblogIcon = postElement.querySelector(`footer ${controlIconSelector} use[href="#managed-icon__reblog"]`);
    if (!reblogIcon) { return; }
    const controlIcon = reblogIcon.closest(controlIconSelector);

    const { canReblog } = await timelineObject(postElement);
    if (!canReblog) { return; }

    const clonedControlButton = cloneControlButton(controlButtonTemplate, { click: event => onButtonClicked(event).catch(showErrorModal) });
    controlIcon.before(clonedControlButton);
  });

export const main = async function () {
  controlButtonTemplate = createControlButtonTemplate(symbolId, buttonClass, 'Reblog (Editable Reblogs)');
  onNewPosts.addListener(processPosts);
};

export const clean = async function () {
  onNewPosts.removeListener(processPosts);
  $(`.${buttonClass}`).remove();
};
