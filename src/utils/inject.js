/**
 * Run a function in the page's "main" execution environment and return its result.
 * This permits access to variables exposed by the Tumblr web platform that are normally inaccessible in the content script sandbox.
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

      document.documentElement.removeEventListener('xkit-injection-response', responseHandler);
      document.documentElement.removeEventListener('xkit-injection-element-response', responseHandler);

      if (exception) {
        reject(exception);
      } else if (type === 'xkit-injection-element-response') {
        resolve(target);
      } else {
        resolve(result);
      }
    };
    document.documentElement.addEventListener('xkit-injection-response', responseHandler);
    document.documentElement.addEventListener('xkit-injection-element-response', responseHandler);

    target.dispatchEvent(
      new CustomEvent('xkit-injection-request', { detail: JSON.stringify(data), bubbles: true }),
    );
  });

const id = Math.random();
const contentScriptId = `content script ${id}`;
const channel = new BroadcastChannel('xkit_test');
channel.addEventListener('message', (event) => {
  if (event.data.id === id) return;
  const now = performance.timeOrigin + performance.now();
  console.log(`${contentScriptId} received message: ${event.data.message}. delay: ${now - event.data.now}`);
});

inject('/main_world/test_broadcast_channel.js', [contentScriptId]);

setInterval(
  () =>
    channel.postMessage({
      id,
      message: `message from ${contentScriptId}`,
      now: performance.timeOrigin + performance.now(),
    }),
  3000,
);

// storage comparison

const storageKey = 'TEST_AKWJDJKWN';

const onStorageChanged = (changes) => {
  if (Object.keys(changes).includes(storageKey)) {
    const data = changes[storageKey].newValue;
    const now = performance.timeOrigin + performance.now();
    console.log(`${contentScriptId} received STORAGE message: ${data.message}. delay: ${now - data.now}`);
  }
};

browser.storage.local.onChanged.addListener(onStorageChanged);

setInterval(
  () =>
    browser.storage.local.set({
      [storageKey]: {
        id,
        message: `message from ${contentScriptId}`,
        now: performance.timeOrigin + performance.now(),
      },
    }),
  3000,
);
