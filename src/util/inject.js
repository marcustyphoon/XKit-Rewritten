let nonce;
const callbacks = new Map();

const messageHandler = event => {
  const {
    origin,
    data: { result, exception, xkitCallbackNonce }
  } = event;

  if (origin === `${location.protocol}//${location.host}` && callbacks.has(xkitCallbackNonce)) {
    const [resolve, reject] = callbacks.get(xkitCallbackNonce);
    callbacks.delete(xkitCallbackNonce);

    if (exception === undefined) {
      resolve(JSON.parse(result || 'null'));
    } else {
      reject(Object.assign(new Error(), JSON.parse(exception)));
    }
  }
};
window.addEventListener('message', messageHandler);

/**
 * @param {Function} asyncFunc - Asynchronous function to run in the page context
 * @param {Array} args - Array of arguments to pass to the function via spread
 * @returns {Promise<any>} The return value of the async function, or the caught exception
 */
export const inject = (asyncFunc, args = []) => new Promise((resolve, reject) => {
  if (!nonce) {
    const scriptWithNonce = [...document.scripts].find(script => script.getAttributeNames().includes('nonce'));
    nonce = scriptWithNonce.nonce || scriptWithNonce.getAttribute('nonce');
  }

  const callbackNonce = Math.random();
  callbacks.set(callbackNonce, [resolve, reject]);

  const script = document.createElement('script');

  script.setAttribute('nonce', nonce);
  script.textContent = `{
    (${asyncFunc.toString()})(...${JSON.stringify(args)})
    .then(result => window.postMessage({
      xkitCallbackNonce: ${callbackNonce},
      result: JSON.stringify(result),
    }, '${location.protocol}//${location.host}'))
    .catch(exception => window.postMessage({
      xkitCallbackNonce: ${callbackNonce},
      exception: JSON.stringify(Object.assign({}, exception, {
        message: exception.message,
        stack: exception.stack,
      })),
    }, '${location.protocol}//${location.host}'))
  }`;

  document.documentElement.appendChild(script);
  script.remove();
});
