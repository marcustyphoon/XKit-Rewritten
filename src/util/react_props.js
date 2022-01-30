import { inject, injectContinuous } from './inject.js';
import { keyToClasses } from './css_map.js';
import { postSelector } from './interface.js';

class AsyncMap {
  constructor () {
    this.data = new Map();
    this.pending = new Map();
  }

  get (key) {
    if (!this.data.has(key)) {
      this.data.set(key, new Promise((resolve) => this.pending.set(key, resolve)));
    }
    return this.data.get(key);
  }

  set (key, value) {
    this.data.set(key, Promise.resolve(value));
    const resolve = this.pending.get(key);
    if (resolve) {
      resolve(value);
      this.pending.delete(key); // appears optional, as calling resolve() multiple times has no effect
    }
  }
}

const cache = new AsyncMap();

const handleResult = ({ id, timelineObject }) => {
  console.log({ id, timelineObject });
  cache.set(id, timelineObject);
};

injectContinuous(function getTimelineObjectInjected ({ postSelector, callback }) {
  const readTimelineObject = (postElement) => {
    const id = postElement.dataset.id;
    if (!id) return;

    const reactKey = Object.keys(postElement).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
    let fiber = postElement[reactKey];

    while (fiber !== null) {
      const { timelineObject } = fiber.memoizedProps || {};
      if (timelineObject !== undefined) {
        // eslint-disable-next-line node/no-callback-literal
        callback({ id, timelineObject });
        return;
      } else {
        fiber = fiber.return;
      }
    }
  };

  [...document.querySelectorAll(postSelector)].forEach(readTimelineObject);

  const observer = new MutationObserver(function timelineObjectNew (mutations) {
    const newPosts = mutations.flatMap(({ addedNodes }) => [...addedNodes])
      .filter(addedNode => addedNode instanceof HTMLElement)
      .filter(addedNode => addedNode.matches(postSelector) || addedNode.matches(`${postSelector} > div`) || addedNode.matches(`${postSelector} article`) || addedNode.querySelector(postSelector) !== null);

    newPosts.forEach(readTimelineObject);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}, { postSelector }, handleResult);

/**
 * @param {string} postID - The post ID of an on-screen post
 * @returns {Promise<object>} - The post's buried timelineObject property (cached; use
 *  timelineObject if you need up-to-date properties that may have changed)
 */
export const timelineObjectMemoized = postID => cache.get(postID);

/**
 * @param {string} postID - The post ID of an on-screen post
 * @returns {Promise<object>} - The post's buried timelineObject property
 */
export const timelineObject = async function (postID) {
  return inject(async id => {
    const postElement = document.querySelector(`[tabindex="-1"][data-id="${id}"]`);
    const reactKey = Object.keys(postElement).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
    let fiber = postElement[reactKey];

    while (fiber !== null) {
      const { timelineObject } = fiber.memoizedProps || {};
      if (timelineObject !== undefined) {
        return timelineObject;
      } else {
        fiber = fiber.return;
      }
    }
  }, [postID]);
};

const unburyGivenPaths = async (selector) => {
  [...document.querySelectorAll(selector)].forEach(timelineElement => {
    const reactKey = Object.keys(timelineElement).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
    let fiber = timelineElement[reactKey];

    while (fiber !== null) {
      const { endpointApiRequest } = fiber.memoizedProps || {};
      if (endpointApiRequest !== undefined) {
        timelineElement.dataset.timeline = endpointApiRequest.givenPath;
        break;
      } else {
        fiber = fiber.return;
      }
    }
  });
};

/**
 * Adds data-timeline attributes to all timeline elements on the page, set to the buried endpointApiRequest.givenPath property
 *
 * @returns {Promise<void>} Resolves when finished
 */
export const exposeTimelines = async () => {
  const timelineClasses = await keyToClasses('timeline');
  const selector = timelineClasses.map(className => `.${className}:not([data-timeline])`).join(',');

  if (document.querySelectorAll(selector).length) {
    inject(unburyGivenPaths, [selector]);
  }
};

/**
 * Manipulate post form tags
 *
 * @param {object} options - Destructured
 * @param {string[]} options.add - Tags to insert into post form
 * @param {string[]} options.remove - Tags to remove from post form
 * @returns {Promise<void>} Resolves when finished
 */
export const editPostFormTags = async ({ add = [], remove = [] }) => inject(async ({ add, remove }) => {
  add = add.map(tag => tag.trim()).filter((tag, index, array) => array.indexOf(tag) === index);

  const selectedTagsElement = document.getElementById('selected-tags');
  if (!selectedTagsElement) { return; }

  const reactKey = Object.keys(selectedTagsElement).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
  let fiber = selectedTagsElement[reactKey];

  while (fiber !== null) {
    let tags = fiber.stateNode?.state?.tags;
    if (Array.isArray(tags)) {
      tags.push(...add.filter(tag => tags.includes(tag) === false));
      tags = tags.filter(tag => remove.includes(tag) === false);
      fiber.stateNode.setState({ tags });
      break;
    } else {
      fiber = fiber.return;
    }
  }
}, [{ add, remove }]);
