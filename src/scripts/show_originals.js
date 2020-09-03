(function() {
  let showOriginalReblogs;
  let excludedBlogsArray;

  let peeprSelector;

  const hideReblogs = async function() {
    const { timelineObject } = await fakeImport('/src/util/react_props.js');

    if (document.querySelector(peeprSelector) !== null) {
      return;
    }

    [...document.querySelectorAll('[data-id]:not(.xkit-show-originals-done)')]
    .forEach(async postElement => {
      postElement.classList.add('xkit-show-originals-done');

      const {blogName, rebloggedFromName, canDelete, content} = await timelineObject(postElement.dataset.id);
      const isOriginal = !rebloggedFromName;

      const showThis =
        isOriginal ||
        (showOriginalReblogs && content.length) ||
        (excludedBlogsArray.length && excludedBlogsArray.includes(blogName)) ||
        canDelete;

      if (!showThis) {
        postElement.classList.add('xkit-show-originals-hidden');
      }
    });
  };

  const onStorageChanged = function(changes, areaName) {
    const {'show_originals.preferences': preferences} = changes;
    if (!preferences || areaName !== 'local') {
      return;
    }

    clean().then(main); // eslint-disable-line no-use-before-define
  };

  const main = async function() {
    browser.storage.onChanged.addListener(onStorageChanged);
    const {'show_originals.preferences': preferences = {}} = await browser.storage.local.get('show_originals.preferences');
    ({showOriginalReblogs = true} = preferences);
    const {excludedBlogs = ''} = preferences;
    excludedBlogsArray = excludedBlogs.split(/[ ,]+/u);

    const { keyToCss } = await fakeImport('/src/util/css_map.js');
    peeprSelector = await keyToCss('peepr');

    const { onNewPosts } = await fakeImport('/src/util/mutations.js');
    onNewPosts.addListener(hideReblogs);
    hideReblogs();
  };

  const clean = async function() {
    browser.storage.onChanged.removeListener(onStorageChanged);
    const { onNewPosts } = await fakeImport('/src/util/mutations.js');
    onNewPosts.removeListener(hideReblogs);

    $('.xkit-show-originals-hidden, .xkit-show-originals-done')
    .removeClass('xkit-show-originals-hidden')
    .removeClass('xkit-show-originals-done');
  };

  const stylesheet = '/src/scripts/show_originals.css';

  return { main, clean, stylesheet };
})();
