/**
 * Creates a function for rate limiting a task, with support for coordinating between browser tabs.
 * The returned function should be called as a necessary condition for running a task. It will return true only if the task has not been run recently within a specified interval, and if the task has not been run in another browser tab running the same code within an increased interval.
 * Thus, tasks contingent upon this function will only execute as quickly as the specified interval. The execution will typically be done by one ("driving") tab, usually the last one opened.
 * @param {string} id Identifier for this rate limit instance
 * @returns {(interval: number) => boolean} A function that returns true if the task should be run.
 */
export const createMultiTabRateLimitFunction = id => {
  let lastRun = 0;
  let lastRunInOtherTab = 0;

  const channel = new BroadcastChannel(`xkit-multi-tab-rate-limit-${id}`);
  channel.addEventListener('message', () => { lastRunInOtherTab = Date.now(); });

  return function thisTabShouldRunTask (interval) {
    const now = Date.now();
    const timeSinceThisTabRun = now - lastRun;
    const timeSinceOtherTabRun = now - lastRunInOtherTab;
    if (timeSinceThisTabRun < interval * 0.9) {
      console.info(
        `XKit Rewritten: skipping ${id.slice(0, 17)} task; this tab ran it ${timeSinceThisTabRun}ms ago`,
      );
      return false;
    }
    if (timeSinceOtherTabRun < interval * 2) {
      console.info(
        `XKit Rewritten: skipping ${id.slice(0, 17)} task; another tab ran it ${timeSinceOtherTabRun}ms ago`,
      );
      return false;
    }
    channel.postMessage(true);
    lastRun = Date.now();
    return true;
  };
};
