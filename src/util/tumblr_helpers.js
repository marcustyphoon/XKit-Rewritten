import { inject } from './inject.js';

const requestApiFetch = async (resource, init) =>
  window.tumblr.apiFetch(resource, init)
    .catch(error => {
      const consoleError = console.error.__sentry_original__ || console.error;
      consoleError('XKit Rewritten API fetch was rejected with:', JSON.stringify(error, null, 2));
      throw error;
    });

/**
 * @param {...any} args - Arguments to pass to window.tumblr.apiFetch()
 * @see {@link https://github.com/tumblr/docs/blob/master/web-platform.md#apifetch}
 * @returns {Promise<Response|Error>} Resolves or rejects with result of window.tumblr.apiFetch()
 */
export const apiFetch = (...args) => inject(requestApiFetch, args);

export const getCssMap = inject(async () => window.tumblr.getCssMap());
export const getLanguageData = inject(async () => window.tumblr.languageData);
