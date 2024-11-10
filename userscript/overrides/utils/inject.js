/**
 * Runs a script in the page's "main" execution environment and returns its result.
 * This permits access to variables exposed by the Tumblr web platform that are normally inaccessible
 * in the content script sandbox.
 * See the src/main_world directory and [../main_world/index.js](../main_world/index.js).
 * @param {string} path - Absolute path of script to inject (will be fed to `runtime.getURL()`)
 * @param {Array} [args] - Array of arguments to pass to the script
 * @param {Element} [target] - Target element; will be accessible as the `this` value in the injected function.
 * @returns {Promise<any>} The transmitted result of the script
 */
export const inject = async (path, args = [], target = document.documentElement) => {
  const cleanPath = path.replace('/main_world/', '').replace('.js', '');
  const func = (await import(`../main_world/${cleanPath}.js`)).default;
  return func.apply(target, args);
};
