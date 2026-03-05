import { keyToCss } from '../../utils/css_map.js';
import { dom } from '../../utils/dom.js';
import { inject } from '../../utils/inject.js';
import { buildStyle, displayInlineFlexUnlessDisabledAttr, notificationSelector } from '../../utils/interface.js';
import { hideModal, modalCancelButton, showErrorModal, showModal } from '../../utils/modals.js';
import { pageModifications } from '../../utils/mutations.js';
import { notify } from '../../utils/notifications.js';
import { getPreferences } from '../../utils/preferences.js';
import { noteObject, timelineObject } from '../../utils/react_props.js';
import { buildSvg } from '../../utils/remixicon.js';
import { apiFetch, navigate } from '../../utils/tumblr_helpers.js';
import { userBlogNames, userBlogs } from '../../utils/user.js';

const storageKey = 'quote_replies.draftLocation';
const buttonClass = 'xkit-quote-replies';

const reblogPreviewClass = 'xkit-quote-replies-preview';
const avatarPreviewClass = 'xkit-quote-replies-avatar-preview';
const textPreviewClass = 'xkit-quote-replies-text-preview';

const blogPlaceholder = {
  avatar: [{ url: 'https://assets.tumblr.com/pop/src/assets/images/avatar/anonymous_avatar_96-223fabe0.png' }],
  name: 'anonymous',
};

// Remove outdated elements when loading module
$(`.${buttonClass}`).remove();

export const styleElement = buildStyle(`
button.xkit-quote-replies {
  align-items: center;
  cursor: pointer;
}

button.xkit-quote-replies.in-notification {
  position: relative;
  align-self: center;
  transform: translateY(-2px);
  margin: 0 6px;
}

button.xkit-quote-replies svg {
  width: 21.5px;
  height: 21.5px;

  fill: rgb(var(--blue));
  transition: all .25s ease-out .4s;
}

button.xkit-quote-replies:disabled svg {
  fill: rgba(var(--black), 0.65);
  transition-property: none;
}

button.xkit-quote-replies.in-notification-dropdown {
  align-self: flex-start;
  margin: 10px 0 0;
}

@media (hover: hover) {
  button.xkit-quote-replies.in-notification svg {
    opacity: 0;
    transform: scale(0);
  }

  ${notificationSelector}:is(:hover, :focus-within) button.xkit-quote-replies.in-notification svg {
    opacity: 1;
    transform: scale(1);
  }
}

.${reblogPreviewClass} {
  box-sizing: border-box;
  width: min(476px, 90vw);
  max-height: 50vh;
  overflow-y: auto;
  padding: 1em;
  margin-top: 1em;

  display: flex;
  flex-direction: column;
  row-gap: 1ch;

  background-color: rgb(var(--navy));
  border-radius: 8px;
  box-shadow: 0 0 1px rgba(var(--white-on-dark), .13);
}

.${reblogPreviewClass} label {
  display: flex;
  flex-direction: row;
  align-items: center;
  column-gap: 1ch;

  user-select: none;
}

.${avatarPreviewClass} {
  width: 38px;
  height: 38px;
  border-radius: 3px;
  flex: none;
}

.${textPreviewClass} {
  overflow-x: hidden;
  text-align: left;
}

.${textPreviewClass} :is(p, strong) {
  margin: 0;
  overflow-x: inherit;
  overflow-y: hidden;

  font-size: 1rem;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.${textPreviewClass} strong {
  font-size: 0.875rem;
}
`);

const originalPostTagStorageKey = 'quick_tags.preferences.originalPostTag';

const activitySelector = `:is(${keyToCss('notification')} > ${keyToCss('activity')}, ${keyToCss('activityContent')})`;

const dropdownSelector = '[role="tabpanel"] *';

let mode;
let originalPostTag;
let tagReplyingBlog;
let newTab;

const processNotifications = notifications => notifications.forEach(async notification => {
  const [notificationProps, userBlogName] = await Promise.all([
    inject('/main_world/get_notification_props.js', [], notification),
    inject('/main_world/get_tumblelogname_prop.js', [], notification),
  ]);

  if (!['reply', 'reply_to_comment', 'note_mention'].includes(notificationProps.type === 'generic' ? notificationProps.subtype : notificationProps.type)) return;
  if (notificationProps.community) return;
  if (notificationProps.actions?.tap?.href && new URL(notificationProps.actions.tap.href).pathname.startsWith('/communities/')) return;

  const activityElement = notification.querySelector(activitySelector);
  if (!activityElement) return;

  activityElement.after(dom(
    'button',
    {
      class: `${buttonClass} in-notification ${notification.matches(dropdownSelector) ? 'in-notification-dropdown' : ''}`,
      [displayInlineFlexUnlessDisabledAttr]: '',
      title: 'Quote this reply',
    },
    {
      click () {
        this.disabled = true;
        setTimeout(() => { this.disabled = false; }, 1000);
        quoteNotificationReply(userBlogName, notificationProps).catch(showErrorModal);
      },
    },
    [buildSvg('ri-chat-quote-line')],
  ));
});

const quoteNotificationReply = async (userBlogName, notificationProps) => {
  const data = notificationProps.type === 'generic'
    ? await createGenericNotificationReplyData(userBlogName, notificationProps)
    : await createNotificationReplyData(userBlogName, notificationProps);

  openPostDraft(userBlogName, data);
};

const processNoteReplyButtons = noteReplyButtons => noteReplyButtons.forEach(async noteReplyButton => {
  const parentNoteElement = noteReplyButton.closest(keyToCss('threadedRepliesWrapper'))?.previousElementSibling;

  const noteData = await noteObject(noteReplyButton);
  const parentNoteData = parentNoteElement && await noteObject(parentNoteElement);
  const timelineObjectData = await timelineObject(noteReplyButton);

  const noteReplyType = determineNoteReplyType({ noteData, parentNoteData, timelineObjectData });
  if (!noteReplyType) return;

  noteReplyButton.parentElement.append(dom(
    'button',
    {
      class: buttonClass,
      [displayInlineFlexUnlessDisabledAttr]: '',
      title: 'Quote this reply',
    },
    {
      click () {
        this.disabled = true;
        setTimeout(() => { this.disabled = false; }, 1000);
        quoteNoteReply({ noteData, noteReplyType, timelineObjectData }).catch(showErrorModal);
      },
    },
    [buildSvg('ri-chat-quote-line')],
  ));
});

const determineNoteReplyType = ({ noteData, parentNoteData, timelineObjectData }) => {
  if (userBlogNames.includes(noteData.blogName)) return false;
  if (timelineObjectData.community) return false;

  if (parentNoteData && userBlogNames.includes(parentNoteData.blogName)) {
    return {
      type: 'reply_to_comment', // "replied to you in a post"
      targetBlogName: parentNoteData.blogName,
    };
  }
  if (userBlogNames.includes(timelineObjectData.blogName)) {
    return {
      type: 'reply', // "replied to your post"
      targetBlogName: timelineObjectData.blogName,
    };
  }
  for (const { formatting = [] } of noteData.content) {
    for (const { type, blog } of formatting) {
      if (type === 'mention' && userBlogNames.includes(blog.name)) {
        return {
          type: 'note_mention', // "mentioned you on a post"
          targetBlogName: blog.name,
        };
      }
    }
  }
  return false;
};

const quoteNoteReply = async ({ noteData, noteReplyType, timelineObjectData }) => {
  const { blogName: replyingBlogName, content: replyContent } = noteData;

  const { type, targetBlogName: userBlogName } = noteReplyType;

  const {
    summary: targetPostSummary,
    postUrl: targetPostUrl,
    blogName: targetTumblelogName,
    id: targetPostId,
  } = timelineObjectData;

  const replyingBlogUuid = await apiFetch(`/v2/blog/${replyingBlogName}/info?fields[blogs]=uuid`)
    .then(({ response: { blog: { uuid } } }) => uuid);

  const data = await createReplyData(userBlogName, { type, replyingBlogName, replyingBlogUuid, targetPostSummary, targetPostUrl, replyContent, targetTumblelogName, targetPostId });
  openPostDraft(userBlogName, data);
};

const createGenericNotificationReplyData = async (userBlogName, notificationProps) => {
  const {
    subtype: type,
    timestamp,
    title: { textContent: titleContent },
    body: { content: [bodyDescriptionContent, bodyQuoteContent] },
    actions,
  } = notificationProps;
  const summaryFormatting = bodyDescriptionContent.formatting?.find(({ type }) => type === 'semantic_color');

  try {
    const [, targetTumblelogName, targetPostId] =
      /^\/@?([a-z0-9-]{1,32})\/([0-9]{1,20})(\/|$)/.exec(new URL(actions.tap.href).pathname);

    const targetPostSummary = summaryFormatting
      ? bodyDescriptionContent.text.slice(summaryFormatting.start + 1, summaryFormatting.end - 1)
      : bodyDescriptionContent.text;

    return await createNotificationReplyData(userBlogName, { type, timestamp, targetPostId, targetTumblelogName, targetPostSummary });
  } catch (exception) {
    console.error(exception);
    console.debug('[XKit] Falling back to generic quote content due to fetch/parse failure');
  }

  // generic quote content fallback code. this always replies as a new post; there is no way to find the source post to create a reblog of it.

  const replyingBlog = titleContent.formatting.find(({ type }) => type === 'mention').blog;

  const content = [
    {
      type: 'text',
      text: `@${replyingBlog.name}`,
      formatting: [
        { start: 0, end: replyingBlog.name.length + 1, type: 'mention', blog: { uuid: replyingBlog.uuid } }],
    },
    {
      type: 'text',
      text: bodyDescriptionContent.text,
      formatting: summaryFormatting
        ? [{ start: summaryFormatting.start, end: summaryFormatting.end, type: 'link', url: actions.tap.href }]
        : [],
    },
    bodyQuoteContent,
    { type: 'text', text: '\u200B' },
  ];
  const tags = [
    ...originalPostTag ? [originalPostTag] : [],
    ...tagReplyingBlog ? [replyingBlog.name] : [],
  ].join(',');

  return { content, tags };
};

const createNotificationReplyData = async (userBlogName, { type, timestamp, targetPostId, targetTumblelogName, targetPostSummary }) => {
  const { response } = await apiFetch(
    `/v2/blog/${targetTumblelogName}/post/${targetPostId}/notes/timeline`,
    { queryParams: { mode: 'replies', before_timestamp: `${timestamp + 1}000000` } },
  );

  const reply = response?.timeline?.elements?.[0];

  if (!reply) throw new Error('No replies found on target post.');
  if ([Math.floor(reply.timestamp), Math.round(reply.timestamp)].includes(timestamp) === false) {
    throw new Error('Reply not found.');
  }

  const { content: replyContent, blog: { name: replyingBlogName, uuid: replyingBlogUuid } } = reply;
  const targetPostUrl = `https://${targetTumblelogName}.tumblr.com/post/${targetPostId}`;

  return createReplyData(userBlogName, { type, replyingBlogName, replyingBlogUuid, targetPostSummary, targetPostUrl, replyContent, targetTumblelogName, targetPostId });
};

const createReplyData = async (userBlogName, { type, replyingBlogName, replyingBlogUuid, targetPostSummary, targetPostUrl, replyContent, targetTumblelogName, targetPostId }) => {
  const options = [{
    label: 'New post',
    data: createNewPostReply({ type, replyingBlogName, replyingBlogUuid, targetPostSummary, targetPostUrl, replyContent }),
  }];

  if (mode === 'new post') return options[0].data;

  try {
    const { response: postData } = await apiFetch(`/v2/blog/${targetTumblelogName}/posts/${targetPostId}`);
    const isReblog = postData.parentPostId && postData.parentTumblelogUuid;
    options.push({
      label: isReblog ? 'Reblog (with trail)' : 'Reblog',
      postData,
      data: createReblogReply({ replyingBlogName, replyingBlogUuid, replyContent, postData }),
    });

    if (isReblog) {
      const { response: rootPostData } = await apiFetch(`/v2/blog/${postData.parentTumblelogUuid}/posts/${postData.parentPostId}`);
      options.splice(1, 0, {
        label: 'Reblog (root post)',
        postData: rootPostData,
        data: createReblogReply({ replyingBlogName, replyingBlogUuid, replyContent, postData: rootPostData }),
      });
    }
  } catch (exception) {
    console.error(exception);
  }

  if (mode === 'reblog' && options.length === 2) return options[1].data;

  if (options.length === 1) {
    return new Promise(resolve => showModal({
      title: 'Quote Replies',
      message: ['The source post cannot be reblogged, so Quote Replies will reply in a new post.'],
      buttons: [
        modalCancelButton,
        dom('button', { class: 'blue' }, {
          click () {
            hideModal();
            resolve(options[0].data);
          },
        }, ['Continue']),
      ],
    }));
  }

  return new Promise(resolve => showModal({
    title: 'Quote Replies',
    message: [
      'Where would you like to reply?',
      ...options.flatMap(({ label, postData = {}, data }) => {
        const { blog, authorBlog, community, content = [], trail = [] } = postData;
        const visibleBlog = community ? authorBlog : blog;

        const createPreviewItem = ({ blog, brokenBlog, content }) => {
          const { avatar, name } = blog ?? brokenBlog ?? blogPlaceholder;
          const { url: src } = avatar.at(-1);
          const textContent = content.map(({ text }) => text).find(Boolean) ?? '\u22EF';

          return dom('label', null, null, [
            dom('img', { class: avatarPreviewClass, src }),
            dom('div', { class: textPreviewClass }, null, [
              dom('strong', null, null, [name]),
              dom('p', null, null, [textContent]),
            ]),
          ]);
        };

        return [
          dom(
            'div',
            { class: reblogPreviewClass },
            null,
            [
              ...trail.map(createPreviewItem),
              ...content.length ? [createPreviewItem({ blog: visibleBlog, content })] : [],
              createPreviewItem({ blog: userBlogs.find(({ name }) => name === userBlogName), content: data.content }),
            ],
          ),
          dom('div', { class: 'buttons' }, null, [
            dom('button', { class: 'blue' }, {
              click () {
                hideModal();
                resolve(data);
              },
            }, [label]),
          ]),
        ];
      }),
    ],
    buttons: [modalCancelButton],
  }));
};

const createNewPostReply = ({ type, replyingBlogName, replyingBlogUuid, targetPostSummary, targetPostUrl, replyContent }) => {
  const verbiage = {
    reply: 'replied to your post',
    reply_to_comment: 'replied to you in a post',
    note_mention: 'mentioned you on a post',
  }[type];
  const text = `@${replyingBlogName} ${verbiage} \u201C${targetPostSummary.replace(/\n/g, ' ')}\u201D:`;
  const formatting = [
    { start: 0, end: replyingBlogName.length + 1, type: 'mention', blog: { uuid: replyingBlogUuid } },
    { start: text.indexOf('\u201C'), end: text.length - 1, type: 'link', url: targetPostUrl },
  ];

  const content = [
    { type: 'text', text, formatting },
    Object.assign(replyContent[0], { subtype: 'indented' }),
    { type: 'text', text: '\u200B' },
  ];
  const tags = [
    ...originalPostTag ? [originalPostTag] : [],
    ...tagReplyingBlog ? [replyingBlogName] : [],
  ].join(',');

  return { content, tags };
};

const createReblogReply = ({ replyingBlogName, replyingBlogUuid, replyContent, postData }) => {
  const { canReblog, id: parentPostId, blog: { isPasswordProtected, uuid: parentTumblelogUUID }, reblogKey } = postData;
  if (canReblog === false || isPasswordProtected) return;

  // omit post summary when replying in a reblog; the post itself is right there!
  const text = `@${replyingBlogName} replied:`;
  const formatting = [
    { start: 0, end: replyingBlogName.length + 1, type: 'mention', blog: { uuid: replyingBlogUuid } },
  ];

  const content = [
    { type: 'text', text, formatting },
    Object.assign(replyContent[0], { subtype: 'indented' }),
    { type: 'text', text: '\u200B' },
  ];
  const tags = tagReplyingBlog ? replyingBlogName : '';

  return { content, tags, parent_post_id: parentPostId, parent_tumblelog_uuid: parentTumblelogUUID, reblog_key: reblogKey };
};

const openPostDraft = async (tumblelogName, data) => {
  const uuid = userBlogs.find(({ name }) => name === tumblelogName).uuid;

  const { response: { id: responseId, displayText } } = await apiFetch(`/v2/blog/${uuid}/posts`, { method: 'POST', body: { state: 'draft', ...data } });

  const currentDraftLocation = `/edit/${tumblelogName}/${responseId}`;

  if (newTab) {
    await browser.storage.local.set({ [storageKey]: currentDraftLocation });

    const openedTab = window.open(`/blog/${tumblelogName}/drafts`);
    if (openedTab === null) {
      browser.storage.local.remove(storageKey);
      notify(displayText);
    }
  } else {
    navigate(currentDraftLocation);
  }
};

export const main = async function () {
  ({ [originalPostTagStorageKey]: originalPostTag } = await browser.storage.local.get(originalPostTagStorageKey));
  ({ mode, tagReplyingBlog, newTab } = await getPreferences('quote_replies'));

  pageModifications.register(notificationSelector, processNotifications);
  pageModifications.register(`${keyToCss('replyCountButton')}:has(use[href="#managed-icon__ds-reply-outline-16"])`, processNoteReplyButtons);

  const { [storageKey]: draftLocation } = await browser.storage.local.get(storageKey);
  browser.storage.local.remove(storageKey);

  if (newTab && draftLocation !== undefined && /^\/blog\/.+\/drafts/.test(location.pathname)) {
    navigate(draftLocation);
  }
};

export const clean = async function () {
  pageModifications.unregister(processNotifications);
  pageModifications.unregister(processNoteReplyButtons);

  $(`.${buttonClass}`).remove();
};

export const onStorageChanged = async function (changes) {
  if (Object.keys(changes).includes(originalPostTagStorageKey)) {
    ({ [originalPostTagStorageKey]: { newValue: originalPostTag } } = changes);
  }

  if (Object.keys(changes).some(key => key.startsWith('quote_replies.preferences'))) {
    ({ mode, tagReplyingBlog, newTab } = await getPreferences('quote_replies'));
  }
};
