import { inject } from './inject.js';

console.log('language_data.js loaded, getting languageData');

export const languageData = await inject(() => window.tumblr.languageData);

console.log('languageData: ', languageData);

/**
 * @param {string} rootString - The English string to translate
 * @returns {string} - The translated string in the current Tumblr locale
 */
export const translate = rootString => languageData.translations[rootString] || rootString;
