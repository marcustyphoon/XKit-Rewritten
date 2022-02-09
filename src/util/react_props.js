import { inject } from './inject.js';
import { keyToCss, resolveExpressions } from './css_map.js';

const permanentCache = {};
const immediateCache = {};

const unburyTimelineObject = async id => {
  const postElement = document.querySelector(`[tabindex="-1"][data-id="${id}"]`);
  const reactKey = Object.keys(postElement).find(key => key.startsWith('__reactFiber'));
  let fiber = postElement[reactKey];

  while (fiber !== null) {
    const { timelineObject } = fiber.memoizedProps || {};
    if (timelineObject !== undefined) {
      return timelineObject;
    } else {
      fiber = fiber.return;
    }
  }
};

/**
 * @param {string} postID - The post ID of an on-screen post
 * @returns {Promise<object>} - The post's buried timelineObject property (cached; use
 *  timelineObjectImmediate if you need up-to-date properties that may have changed)
 */
export const timelineObjectMemoized = async postID => permanentCache[postID] || timelineObject(postID);

/**
 * @param {string} postID - The post ID of an on-screen post
 * @returns {Promise<object>} - The post's buried timelineObject property (queried immediately)
 */
export const timelineObjectImmediate = async postID => immediateCache[postID] || timelineObject(postID);

const timelineObject = async function (postID) {
  const resultPromise = inject(unburyTimelineObject, [postID]);

  immediateCache[postID] = resultPromise;
  permanentCache[postID] = permanentCache[postID] ?? resultPromise;
  resultPromise.then(() => { delete immediateCache[postID]; });
  return resultPromise;
};

const unburyGivenPaths = async (selector) => {
  [...document.querySelectorAll(selector)].forEach(timelineElement => {
    const reactKey = Object.keys(timelineElement).find(key => key.startsWith('__reactFiber'));
    let fiber = timelineElement[reactKey];

    while (fiber !== null) {
      const { endpointApiRequest } = fiber.memoizedProps || {};
      if (endpointApiRequest !== undefined) {
        timelineElement.dataset.timeline = endpointApiRequest.givenPath;

        // distinguishes between the timelines in 'secret' dashboards:
        // tumblr.com/timeline/blog_subscriptions
        // tumblr.com/timeline/crushes
        // tumblr.com/timeline/what_you_missed
        // tumblr.com/timeline/trending
        const which = endpointApiRequest?.options?.queryParams?.which;
        if (which) {
          timelineElement.dataset.which = which;
        }
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
  const timelineSelector = await resolveExpressions`${keyToCss('timeline')}:not([data-timeline])`;
  if (document.querySelector(timelineSelector) !== null) {
    return inject(unburyGivenPaths, [timelineSelector]);
  }
};

const controlTagsInput = async ({ add, remove }) => {
  add = add.map(tag => tag.trim()).filter((tag, index, array) => array.indexOf(tag) === index);

  const selectedTagsElement = document.getElementById('selected-tags');
  if (!selectedTagsElement) { return; }

  const reactKey = Object.keys(selectedTagsElement).find(key => key.startsWith('__reactFiber'));
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
};

/**
 * Manipulate post form tags
 *
 * @param {object} options - Tags to add/remove to/from the current post form
 * @param {string[]} [options.add] - Tags to insert
 * @param {string[]} [options.remove] - Tags to remove
 * @returns {Promise<void>} Resolves when finished
 */
export const editPostFormTags = async ({ add = [], remove = [] }) => inject(controlTagsInput, [{ add, remove }]);
