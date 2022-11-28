import { inject } from './inject.js';

/**
 * @param {...any} args - Arguments to pass to window.tumblr.apiFetch()
 * @see {@link https://github.com/tumblr/docs/blob/master/web-platform.md#apifetch}
 * @returns {Promise<Response|Error>} Resolves or rejects with result of window.tumblr.apiFetch()
 */
export const apiFetch = async function (...args) {
  return inject(
    async (resource, init = {}) => {
      // add XKit header to all API requests
      init.headers ??= {};
      init.headers['X-XKit'] = '1';

      // convert all keys in the body to snake_case
      if (init.body !== undefined) {
        const objects = [init.body];

        while (objects.length !== 0) {
          const currentObjects = objects.splice(0);

          currentObjects.forEach(obj => {
            Object.keys(obj).forEach(key => {
              const snakeCaseKey = key
                .replace(/^[A-Z]/, match => match.toLowerCase())
                .replace(/[A-Z]/g, match => `_${match.toLowerCase()}`);

              if (snakeCaseKey !== key) {
                obj[snakeCaseKey] = obj[key];
                delete obj[key];
              }
            });
          });

          objects.push(
            ...currentObjects
              .flatMap(Object.values)
              .filter(value => value instanceof Object)
          );
        }
      }

      return window.tumblr.apiFetch(resource, init);
    },
    args
  );
};

/* eslint-disable camelcase */
const snakeToCamel = word => word.replace(/_(.)/g, (match, g1) => g1.toUpperCase());

/**
 * @see https://github.com/tumblr/docs/blob/master/api.md#postspost-id---editing-a-post-neue-post-format
 * @see https://github.com/tumblr/docs/blob/master/api.md#posts---createreblog-a-post-neue-post-format
 */
const editRequestParamsSnake = [
  'content',
  'layout',
  'state',
  'publish_on',
  'date',
  'tags',
  'source_url',
  'send_to_twitter',
  'slug',
  'interactability_reblog',

  'can_be_tipped',
  'has_community_label',
  'community_label_categories'
];
const editRequestParams = [...editRequestParamsSnake, ...editRequestParamsSnake.map(snakeToCamel)];

// TODO: only accept apifetch results? you should be fetching, not using timelineObject, to avoid stale data
// make sure bulk-fetched post data works though
// (snake_case handling is probably unnecessary - no way for this to happen in input; easier to overwrite)

/**
 * Create the request body to edit a post using a PUT request to /posts/{post-id} without changing the post.
 * camelCase or snake_case property keys are supported and will be passed through unchanged.
 *
 * @param {object} postProperties - Post properties from an API fetch or timelineObject.
 * @returns {object} editRequestBody - /posts/{post-id} PUT request body parameters
 */
export const createEditRequest = postProperties => {
  const { tags, source_url_raw, sourceUrlRaw, ...rest } = postProperties;

  const entries = Object.entries({
    ...rest,
    tags: tags.join(','),
    source_url: source_url_raw,
    sourceUrl: sourceUrlRaw
  });

  return Object.fromEntries(entries.filter(([key, value]) => editRequestParams.includes(key)));
};
