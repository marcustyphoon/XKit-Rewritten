export default function getRunningXkit (currentVersion) {
  const runningVersion = window.xkitRewrittenRunning;
  Object.defineProperty(window, 'xkitRewrittenRunning', {
    value: currentVersion,
    writable: false,
    enumerable: false,
    configurable: true
  });
  return runningVersion;
}
