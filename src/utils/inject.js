const key = Date.now();

await new Promise(resolve => {
  document.documentElement.addEventListener(`xkit-injection-ready-${key}`, resolve, { once: true });

  const { nonce } = [...document.scripts].find(script => script.getAttributeNames().includes('nonce'));
  const script = Object.assign(document.createElement('script'), {
    type: 'module',
    nonce,
    src: browser.runtime.getURL(`/main_world/index.js?key=${key}`),
  });
  document.documentElement.append(script);
});

/**
 * Runs a function in the page's "main" execution environment and returns
 * its result. This permits access to variables exposed by the Tumblr web
 * platform that are normally inaccessible in the content script sandbox.
 * @see [src/main_world/index.js](../main_world/index.js) and named scripts in the same directory
 * @param {string} path Absolute path of script file to inject; will be fed to {@linkcode https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/getURL|browser.runtime.getURL()}
 * @param {Array} [args] Array of arguments to pass to the injected function
 * @param {Element} [target] Target element; will be accessible as the `this` value in the injected function
 * @returns {Promise} The transmitted result of the function call
 */
export const inject = (path, args = [], target = document.documentElement) =>
  new Promise((resolve, reject) => {
    const requestId = String(Math.random());
    const data = { path: browser.runtime.getURL(path), args, id: requestId };

    const responseHandler = ({ detail, type, target }) => {
      const { id, result, exception } = JSON.parse(detail);
      if (id !== requestId) return;

      document.documentElement.removeEventListener(`xkit-injection-response-${key}`, responseHandler);
      document.documentElement.removeEventListener(`xkit-injection-element-response-${key}`, responseHandler);

      if (exception) {
        reject(exception);
      } else if (type === 'xkit-injection-element-response') {
        resolve(target);
      } else {
        resolve(result);
      }
    };
    document.documentElement.addEventListener(`xkit-injection-response-${key}`, responseHandler);
    document.documentElement.addEventListener(`xkit-injection-element-response-${key}`, responseHandler);

    target.dispatchEvent(
      new CustomEvent(`xkit-injection-request-${key}`, { detail: JSON.stringify(data), bubbles: true }),
    );
  });
