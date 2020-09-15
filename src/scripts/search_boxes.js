(function () {
  let maxResults;

  let searching;
  let term;
  let results;
  let postsLoaded;

  let endlessScrollingDisabled;
  let searchingCss;

  const onStorageChanged = async function (changes, areaName) {
    if (areaName !== 'local') { return; }

    const {
      'search_boxes.preferences.maxResults': maxResultsChanges,
    } = changes;

    if (maxResultsChanges) {
      maxResults = parseInt(maxResultsChanges.newValue);
      maxResults = !isNaN(maxResults) && maxResults > 0 ? maxResults : 200;
    }
  };

  const main = async function () {
    browser.storage.onChanged.addListener(onStorageChanged);
    // add: don't run on the dashboard

    const { getPreferences } = await fakeImport('/src/util/preferences.js');
    const { keyToCss } = await fakeImport('/src/util/css_map.js');

    const { maxResultsPref } = await getPreferences('search_boxes');

    maxResults = parseInt(maxResultsPref);
    maxResults = !isNaN(maxResults) && maxResults > 0 ? maxResults : 200;

    searching = false;
    term = null;
    results = 0;
    postsLoaded = 0;

    const { translate } = await fakeImport('/src/util/language_data.js');
    const nextAriaLabel = await translate('Next');
    if ($(`button[aria-label='${nextAriaLabel}']`).length) {
      endlessScrollingDisabled = true;
    }

    const $sidebarContainer = $(await keyToCss('sidebar')).find('> aside');

    const searchBoxHtml =
      `<div id='xkit-search-box'>
        <input type='text' placeholder='Search Posts...' id='xkit-search-input'>
      </div>`;
    $($sidebarContainer).prepend(searchBoxHtml);
    $('#xkit-search-input').keydown(event => event.stopPropagation());
    $('#xkit-search-input').click(newSearchTerm);

    const newSearchDebounced = debounce(newSearchTerm, 500);
		$('#xkit-search-input').keyup(newSearchDebounced);
  };

  // Stolen from mutations.js
  // const debounce = (callback, ms) => {
  //   let timeoutID;
  //   return (...args) => {
  //     clearTimeout(timeoutID);
  //     timeoutID = setTimeout(() => callback(...args), ms);
  //   };
  // };

  // Stolen from xkit 7
  const debounce = function(func, wait) {
    var timeout_id;
    return function() {
      var last_context = this;
      var last_args = arguments;

      var exec = function() {
        timeout_id = null;
        func.apply(last_context, last_args);
      };
      clearTimeout(timeout_id);
      timeout_id = setTimeout(exec, wait);
    };
  };

  const newSearchTerm = async function() {
    var newTerm = $(this).val().toLowerCase().trim();
    if (newTerm.length < 2) {
      newTerm = '';
    }
    if (term != newTerm) {
      if (!searching) {
        await searchStart();
      }
      term = newTerm;
      results = 0;
      const $allPosts = $('#xkit-search-timeline [data-id]');
      postsLoaded = $allPosts.length;
      updateStatusBar(`Searching for <b>"${term}"</b>, please wait...`);

      waitForRender().then(() => {
        //add: unmark
        $allPosts
          .removeClass('xkit-search-done')
          .removeClass('xkit-search-shown');
        filterPosts(term);
      });
    }
  };

  const searchStart = async function() {
    searching = true;
    const { onNewPosts } = await fakeImport('/src/util/mutations.js');
    const { keyToCss, descendantSelector } = await fakeImport('/src/util/css_map.js');
    const { addStyle } = await fakeImport('/src/util/interface.js');
    onNewPosts.addListener(processNewPosts);
    $(await keyToCss('timeline')).attr('id', 'xkit-search-timeline');
    $(await descendantSelector('timeline', 'loader')).attr('id', 'xkit-search-loader');
    $('#xkit-search-timeline').after(`<div id='prevent-load'></div>`);

    updateStatusBar(`Searching for <b>"${term}"</b>`);
    waitForRender().then(() => {
      searchingCss =
        `#xkit-search-timeline {
          min-height: calc(100vh - ${$('#xkit-search-timeline').offset().top - 10}px);
        }
        #xkit-search-timeline article {
          display: none;
        }
        #xkit-search-timeline .xkit-search-shown article {
          display: block;
        }`;
        addStyle(searchingCss);
    });
  };

  const searchEnd = async function() {
    searching = false;
    const { onNewPosts } = await fakeImport('/src/util/mutations.js');
    onNewPosts.removeListener(processNewPosts);

    term = null;
    $('#xkit-search-input').val('');
    $('#xkit-search-timeline [data-id]')
      .removeClass('xkit-search-done')
      .removeClass('xkit-search-shown');
    $('.xkit-search-status-bar').remove();
    $('#prevent-load').remove();
    $('#xkit-search-timeline').removeAttr('id');

    const { removeStyle } = await fakeImport('/src/util/interface.js');
    removeStyle(searchingCss);
  };

  const processNewPosts = async function() {
    if (!searching) { return; }
    // add: don't run on the dashboard
    const $allPosts = $('#xkit-search-timeline [data-id]');
    if ($allPosts.length <= postsLoaded) { return; }
    postsLoaded = $allPosts.length;
    if (!term) {
      updateStatusBar('...');
      return;
    }
    waitForRender().then(() => {
      filterPosts(term);
    });
  };

  const filterPosts = async function(term) {
    var postsToShow = [];
    if (!term) {
      updateStatusBar('...');
      return;
    }

    const $posts = $('#xkit-search-timeline [data-id]:not(.xkit-search-done)')
      .addClass('xkit-search-done');

    updateStatusBar(`Searching for <b>"${term}"</b>, please wait...`);

    let renderChunkSize = 3;
    const render = function() {
      for (const postToShow of postsToShow) {
        postToShow.classList.add('xkit-search-shown');
        //add: mark
      }
      postsToShow = [];
      updateStatusBar(`Searching for <b>"${term}"</b>, please wait...`);
    };

    for (const post of $posts) {
      if (term != term) { return; }
      if (results >= maxResults) {
        updateStatusBar(`Searching for <b>"${term}"</b>`);
        break;
      }

      // gonna just replace this with mark.js probably
      let text = await getPostText(post);
      console.log(text);

      if (text.toLowerCase().indexOf(term) > -1) {
        postsToShow.push(post);
        results++;

        if (postsToShow.length >= renderChunkSize) {
          if (term != term) {
            //search term has changed while we were processing
            return;
          }
          renderChunkSize = 13;
          render();
          await waitForRender();
        }
      }
    }
    render();
    updateStatusBar(`Searching for <b>"${term}"</b>`);
  };

  // gonna just replace this with mark.js probably
  const getPostText = async function(post) {
    const { timelineObject } = await fakeImport('/src/util/react_props.js');
		var text = [];
		const {blogName, rebloggedFromName, rebloggedRootname, sourceTitle, askingName, content, trail, postAuthor, tags} =
			await timelineObject(post.getAttribute('data-id'));
		text.push(blogName, rebloggedFromName, rebloggedRootname);
		if (askingName) {
			text.push(askingName + ' asked:');
		}

		const processContent = function(input) {
			for (let block of input) {
				if (block.attribution) {
					text.push(block.attribution.appName, block.attribution.displayText, block.attribution.url);
				}
				if (block.description) {
					text.push(block.description);
				}
				if (block.displayUrl) {
					text.push(block.displayUrl);
				}
				if (block.title) {
					text.push(block.title);
				}
				if (block.artist) {
					text.push(block.artist);
				}
				if (block.artist) {
					text.push(block.album);
				}
				if (block.text) {
					text.push(block.text);
				}
				if (block.formatting) {
					for (let formatblock of block.formatting) {
						if (formatblock.url) {
							// Follow tumblr-redirected URLs
							if (formatblock.url.indexOf('t.umblr.com/redirect') > -1) {
								text.push(new URL(formatblock.url).searchParams.get('z'));
							} else {
								text.push(formatblock.url);
							}
						}
					}
				}
			}
		};

		if (trail) {
			for (let reblog of trail) {
				if (reblog.blog) {
					text.push(reblog.blog.name);
				}
				if (reblog.brokenBlog) {
					text.push(reblog.brokenBlog.name);
				}
				if (reblog.content) {
					processContent(reblog.content);
				}
			}
		}
		if (content) {
			processContent(content);
		}

		if (sourceTitle) {
			text.push("source: " + sourceTitle);
		}
		if (postAuthor) {
			text.push("submitted by: " + postAuthor);
		}
		if (tags) {
			for (let tag of tags) {
				text.push('#' + tag);
			}
		}
		return text.join('\n');
	};

  const updateStatusBar = function(status) {
    let statusHtml;
    if (results >= maxResults) {
      statusHtml = status +
        `<br/>Showing the first ${maxResults} results found out of ${postsLoaded} loaded posts.<br/>
        Increase the maximum result count in Search My Stuff's preferences.<br/>
        <a class='destroy-button'>Exit search and show all posts</a>`;

    } else if (endlessScrollingDisabled) {
      statusHtml = status +
        `<br/>${results} results on this page.<br/>
        Endless scrolling is recommended with the Search My Stuff extension.<br/>
        <a class='destroy-button'>Exit search and show all posts</a>`;
    } else {
      statusHtml = status +
        `<br/>${results} results found out of ${postsLoaded} loaded posts.<br/>
        Scroll down to load more posts and results.<br/>
        <a class='destroy-button'>Exit search and show all posts</a>`;
    }

    if (results > 0 || endlessScrollingDisabled) {
      if ($('#xkit-search-status-bar-top').length > 0) {
        $('#xkit-search-status-bar-top').html(statusHtml);
       } else {
        $('#xkit-search-timeline').before(`<div id='xkit-search-status-bar-top' class='xkit-search-status-bar'>${statusHtml}</div>`);
        $('#xkit-search-status-bar-top').on('click', '.destroy-button', searchEnd);
      }
    } else {
      $('#xkit-search-status-bar-top').remove();
    }

    if ($('#xkit-search-status-bar-bottom').length > 0) {
      $('#xkit-search-status-bar-bottom').html(statusHtml);
     } else {
      $('#xkit-search-loader').prepend(`<div id='xkit-search-status-bar-bottom' class='xkit-search-status-bar'>${statusHtml}</div>`);
      $('#xkit-search-status-bar-bottom').on('click', '.destroy-button', searchEnd);
    }
  };

  /**
   * Returns a promise that resolves only once any changes previously made to the DOM have been
   * rendered on the page.
   *
   * @return {Promise}
   */
  const waitForRender = function() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  };

  const clean = async function () {
    browser.storage.onChanged.removeListener(onStorageChanged);
    await searchEnd();
    $('#xkit-search-box').remove();
  };

  // TODO:
  // don't run literally everywhere lmao (handle soft refresh/navigation)
  // mark.js
  // use mark.js instead of actually searching manually?
  // use sidebar function when availible
  // double check all asynchronous logic

  return { main, clean, stylesheet: true };
  })();
