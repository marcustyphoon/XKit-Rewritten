(function () {
  const meatballButtonLabel = 'Block this post';
  const excludeClass = 'xkit-postblock-done';
  const hiddenClass = 'xkit-postblock-hidden';
  const storageKey = 'postblock.blockedPostRootIDs';

  const processPosts = async function () {
    const { getPostElements } = await fakeImport('/util/interface.js');
    const { timelineObjectMemoized } = await fakeImport('/util/react_props.js');

    const { [storageKey]: blockedPostRootIDs = [] } = await browser.storage.local.get(storageKey);

    getPostElements({ excludeClass, includeFiltered: true }).forEach(async postElement => {
      const postID = postElement.dataset.id;
      const { rebloggedRootId } = await timelineObjectMemoized(postID);

      const rootID = rebloggedRootId || postID;

      if (blockedPostRootIDs.includes(rootID)) {
        postElement.classList.add(hiddenClass);
      } else {
        postElement.classList.remove(hiddenClass);
      }
    });
  };

  const onButtonClicked = async function ({ target }) {
    const { timelineObjectMemoized } = await fakeImport('/util/react_props.js');
    const postElement = $(target).parents('[data-id]')[0];
    const postID = postElement.dataset.id;

    const { rebloggedRootId } = await timelineObjectMemoized(postID);
    const rootID = rebloggedRootId || postID;

    if (window.confirm('Block this post? All instances of this post (including reblogs) will be hidden.')) {
      const { [storageKey]: blockedPostRootIDs = [] } = await browser.storage.local.get(storageKey);
      blockedPostRootIDs.push(rootID);
      browser.storage.local.set({ [storageKey]: blockedPostRootIDs });

      postElement.classList.add(hiddenClass);
    }
  };

  const onStorageChanged = async function (changes, areaName) {
    if (areaName === 'local' && Object.keys(changes).includes(storageKey)) {
      $(`.${excludeClass}`).removeClass(excludeClass);
      processPosts();
    }
  };

  const main = async function () {
    browser.storage.onChanged.addListener(onStorageChanged);
    const { registerMeatballItem } = await fakeImport('/util/interface.js');
    const { onNewPosts } = await fakeImport('/util/mutations.js');

    registerMeatballItem(meatballButtonLabel, onButtonClicked);

    onNewPosts.addListener(processPosts);
    processPosts();
  };

  const clean = async function () {
    browser.storage.onChanged.removeListener(onStorageChanged);
    const { unregisterMeatballItem } = await fakeImport('/util/interface.js');
    const { onNewPosts } = await fakeImport('/util/mutations.js');

    unregisterMeatballItem(meatballButtonLabel);
    onNewPosts.removeListener(processPosts);

    $(`.${excludeClass}`).removeClass(excludeClass);
    $(`.${hiddenClass}`).removeClass(hiddenClass);
  };

  return { main, clean, stylesheet: true };
})();
