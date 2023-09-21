import { dom } from './dom.js';

const { nonce } = [...document.scripts].find(script => script.getAttributeNames().includes('nonce'));

/**
 * @param {string} name - Function to run in the page context (can be async)
 * @param {Array} [args] - Array of arguments to pass to the function via spread
 * @param {Element} [target] - Element to append script to; will be accessible as
 *                             document.currentScript.parentElement in the injected function.
 * @returns {Promise<any>} The return value of the function, or the caught exception
 */
export const inject = async (name, args = [], target = document.documentElement) => {
  const script = dom('script', { nonce, src: browser.runtime.getURL('/injected.js') });
  script.dataset.data = JSON.stringify({ name, args });

  return new Promise((resolve, reject) => {
    const attributeObserver = new MutationObserver((mutations, observer) => {
      if (mutations.some(({ attributeName }) => attributeName === 'data-result')) {
        observer.disconnect();
        resolve(JSON.parse(script.dataset.result));
      } else if (mutations.some(({ attributeName }) => attributeName === 'data-exception')) {
        observer.disconnect();
        reject(JSON.parse(script.dataset.exception));
      }
    });

    attributeObserver.observe(script, {
      attributes: true,
      attributeFilter: ['data-result', 'data-exception']
    });
    target.append(script);
  });
};
