(function () {
  const storageKey = 'tag_tracking_plus.trackedTagTimestamps';
  const excludeClass = 'xkit-tag-tracking-plus-done';
  let sidebarItemElement;
  let intervalID;

  const processPosts = async function () {
    const { searchParams } = new URL(location);
    if (!location.pathname.startsWith('/tagged/') || searchParams.get('sort') === 'top') {
      return;
    }

    const { apiFetch } = await fakeImport('/util/tumblr_helpers.js');
    const { getPostElements } = await fakeImport('/util/interface.js');
    const { timelineObjectMemoized } = await fakeImport('/util/react_props.js');

    const currentTag = decodeURIComponent(location.pathname.split('/')[2].replace(/\+/g, ' '));
    const { response: { following } } = await apiFetch('/v2/user/tags/following', { queryParams: { tag: currentTag } });
    if (!following) {
      return;
    }

    const { [storageKey]: timestamps = {} } = await browser.storage.local.get(storageKey);
    for (const postElement of getPostElements({ excludeClass, noPeepr: true, includeFiltered: true })) {
      const { timestamp } = await timelineObjectMemoized(postElement.dataset.id);
      const savedTimestamp = timestamps[currentTag] || 0;

      if (timestamp > savedTimestamp) {
        timestamps[currentTag] = timestamp;
      }
    }
    await browser.storage.local.set({ [storageKey]: timestamps });

    const sidebarCount = sidebarItemElement.querySelector(`a[href="/tagged/${encodeURIComponent(currentTag)}"] .count`);
    if (sidebarCount !== null) {
      sidebarCount.textContent = '';
    }
  };

  const main = async function () {
    const { apiFetch } = await fakeImport('/util/tumblr_helpers.js');
    const { addSidebarItem } = await fakeImport('/util/sidebar.js');
    const { onNewPosts } = await fakeImport('/util/mutations.js');

    const { response: { tags } } = await apiFetch('/v2/user/tags');

    const sidebarItem = {
      id: 'tag-tracking-plus',
      title: 'Tracked Tags',
      items: tags.map(({ name }) => ({ label: name, href: `/tagged/${encodeURIComponent(name)}`, count: '' })),
    };

    sidebarItemElement = addSidebarItem(sidebarItem);

    onNewPosts.addListener(processPosts);
    await processPosts();

    const updateUnreadCounts = async () => {
      const { [storageKey]: timestamps = {} } = await browser.storage.local.get(storageKey);
      tags.forEach(async ({ name }) => {
        if (!timestamps[name]) {
          timestamps[name] = 0;
        }

        const sidebarCount = sidebarItemElement.querySelector(`a[href="/tagged/${encodeURIComponent(name)}"] .count`);
        if (sidebarCount.textContent.includes('+')) { return; }

        const { response: { timeline: { elements } } } = await apiFetch(`/v2/hubs/${name}/timeline`, { queryParams: { limit: 20, sort: 'recent' } });
        let unreadCount = 0;

        for (const post of elements) {
          const { timestamp } = post;
          if (timestamp <= timestamps[name]) {
            break;
          } else {
            unreadCount++;
          }
        }

        if (unreadCount === 0) {
          unreadCount = '';
        } else if (unreadCount === elements.length) {
          unreadCount += '+';
        }

        sidebarCount.textContent = unreadCount;
      });
    };

    intervalID = setInterval(updateUnreadCounts, 600000);
    updateUnreadCounts();
  };

  const clean = async function () {
    const { removeSidebarItem } = await fakeImport('/util/sidebar.js');
    const { onNewPosts } = await fakeImport('/util/mutations.js');

    removeSidebarItem('tag-tracking-plus');
    onNewPosts.removeListener(processPosts);
    clearInterval(intervalID);
  };

  return { main, clean };
})();
