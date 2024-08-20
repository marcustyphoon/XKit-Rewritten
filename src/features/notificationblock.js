import { buildStyle, notificationSelector } from '../utils/interface.js';
import { registerMeatballItem, unregisterMeatballItem } from '../utils/meatballs.js';
import { onNewNotifications } from '../utils/mutations.js';
import { showModal, hideModal, modalCancelButton } from '../utils/modals.js';
import { dom } from '../utils/dom.js';
import { userBlogNames } from '../utils/user.js';
import { apiFetch } from '../utils/tumblr_helpers.js';
import { notificationObject } from '../utils/react_props.js';
import { keyToCss } from '../utils/css_map.js';
import { getPreferences } from '../utils/preferences.js';

const storageKey = 'notificationblock.blockedPostTargetIDs';
const meatballButtonBlockId = 'notificationblock-block';
const meatballButtonBlockLabel = 'Block notifications';
const meatballButtonUnblockId = 'notificationblock-unblock';
const meatballButtonUnblockLabel = 'Unblock notifications';

let blockedPostTargetIDs;

const hiddenAttribute = 'data-notificationblock-hidden';
const placeholdersClass = 'xkit-notificationblock-placeholder';

export const styleElement = buildStyle(`
[${hiddenAttribute}] > ${notificationSelector} {
  display: none !important;
}

body.${placeholdersClass} [${hiddenAttribute}]:is(
  :has(> ${keyToCss('dateSeparatorWrapper')}),
  :not([${hiddenAttribute}] + *)
)::after {
  display: block;
  padding-bottom: 1ch;

  content: "(hidden notifications)";
  text-align: center;
  color: rgba(var(--black), .65);
  font-size: .875rem;
}
`);

const processNotifications = (notificationElements) => {
  notificationElements.forEach(async notificationElement => {
    const notification = await notificationObject(notificationElement);
    if (notification !== undefined) {
      const { targetRootPostId, targetPostId } = notification;
      const rootId = targetRootPostId || targetPostId;
      if (blockedPostTargetIDs.includes(rootId)) {
        notificationElement.parentElement.setAttribute(hiddenAttribute, '');
      }
    }
  });
};

const muteNotificationsMessage = [
  '\n\n',
  'Unlike Tumblr\'s option to "Mute notifications", this will not prevent notifications for this post from being created, so they will still increment your unread notification count.',
  '\n\n',
  'You can use "Mute Notifications" in addition to or instead of this feature. ',
  'It will completely prevent the post from generating notifications while it is enabled, and can be applied temporarily or permanently.'
];

const onButtonClicked = async function ({ currentTarget }) {
  const { id, rebloggedRootId, blog: { uuid } } = currentTarget.__timelineObjectData;
  const { response: { muted } } = await apiFetch(`/v2/blog/${uuid}/posts/${id}`);

  const rootId = rebloggedRootId || id;
  const shouldBlockNotifications = blockedPostTargetIDs.includes(rootId) === false;

  const title = shouldBlockNotifications
    ? 'Block this post\'s notifications?'
    : 'Unblock this post\'s notifications?';
  const message = shouldBlockNotifications
    ? [
        'Notifications for this post will be hidden from your activity feed.',
        ...(muted ? [] : muteNotificationsMessage)
      ]
    : ['Notifications for this post will appear in your activity feed again.'];

  const textContent = shouldBlockNotifications
    ? 'Block notifications'
    : 'Unblock notifications';
  const className = shouldBlockNotifications
    ? 'red'
    : 'blue';
  const saveNotificationPreference = shouldBlockNotifications
    ? () => { blockedPostTargetIDs.push(rootId); browser.storage.local.set({ [storageKey]: blockedPostTargetIDs }); }
    : () => browser.storage.local.set({ [storageKey]: blockedPostTargetIDs.filter(blockedId => blockedId !== rootId) });

  showModal({
    title,
    message,
    buttons: [
      modalCancelButton,
      dom('button', { class: className }, {
        click () {
          hideModal();
          saveNotificationPreference();
        }
      }, [textContent])
    ]
  });
};

const blockPostFilter = async ({ blogName, rebloggedRootName, rebloggedFromName, id, rebloggedRootId, community, postAuthor }) => {
  const rootId = rebloggedRootId || id;
  const canReceiveActivity = userBlogNames.includes(blogName) ||
    userBlogNames.includes(rebloggedFromName) ||
    userBlogNames.includes(rebloggedRootName) ||
    (community && userBlogNames.includes(postAuthor));

  return canReceiveActivity && blockedPostTargetIDs.includes(rootId) === false;
};

const unblockPostFilter = async ({ id, rebloggedRootId }) => {
  const rootId = rebloggedRootId || id;
  return blockedPostTargetIDs.includes(rootId);
};

export const main = async function () {
  const { placeholders } = await getPreferences('notificationblock');
  document.body.classList[placeholders ? 'add' : 'remove'](placeholdersClass);

  ({ [storageKey]: blockedPostTargetIDs = [] } = await browser.storage.local.get(storageKey));
  onNewNotifications.addListener(processNotifications);

  registerMeatballItem({ id: meatballButtonBlockId, label: meatballButtonBlockLabel, onclick: onButtonClicked, postFilter: blockPostFilter });
  registerMeatballItem({ id: meatballButtonUnblockId, label: meatballButtonUnblockLabel, onclick: onButtonClicked, postFilter: unblockPostFilter });
};

export const clean = async function () {
  onNewNotifications.removeListener(processNotifications);
  unregisterMeatballItem(meatballButtonBlockId);
  unregisterMeatballItem(meatballButtonUnblockId);

  $(`[${hiddenAttribute}]`).removeAttr(hiddenAttribute);
  document.body.classList.remove(placeholdersClass);
};
