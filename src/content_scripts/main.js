'use strict';

{
  const { getURL } = browser.runtime;
  const isRedpop = () => [...document.scripts].some(({ src }) => src.includes('/pop/'));
  const isReactLoaded = () => document.querySelector('[data-rh]') === null;

  const restartListeners = {};

  const runScript = async function (name) {
    const scriptPath = getURL(`/scripts/${name}.js`);
    const { main, clean, stylesheet, onStorageChanged } = await import(scriptPath);

    main();

    if (stylesheet) {
      const link = Object.assign(document.createElement('link'), {
        rel: 'stylesheet',
        href: getURL(`/scripts/${name}.css`)
      });
      document.documentElement.appendChild(link);
    }

    restartListeners[name] = function (changes, areaName) {
      if (areaName !== 'local') return;

      const { enabledScripts } = changes;
      if (enabledScripts && !enabledScripts.newValue.includes(name)) return;

      if (onStorageChanged instanceof Function) {
        onStorageChanged(changes, areaName);
      } else if (Object.keys(changes).some(key => key.startsWith(`${name}.preferences`) && changes[key].oldValue !== undefined)) {
        clean().then(main);
      }
    };

    browser.storage.onChanged.addListener(restartListeners[name]);
  };

  const destroyScript = async function (name) {
    const scriptPath = getURL(`/scripts/${name}.js`);
    const { clean, stylesheet } = await import(scriptPath);

    clean();

    if (stylesheet) {
      document.querySelector(`link[href="${getURL(`/scripts/${name}.css`)}"]`)?.remove();
    }

    browser.storage.onChanged.removeListener(restartListeners[name]);
    delete restartListeners[name];
  };

  const onStorageChanged = async function (changes, areaName) {
    if (areaName !== 'local') {
      return;
    }

    const { enabledScripts } = changes;

    if (enabledScripts) {
      const { oldValue = [], newValue = [] } = enabledScripts;

      const newlyEnabled = newValue.filter(x => oldValue.includes(x) === false);
      const newlyDisabled = oldValue.filter(x => newValue.includes(x) === false);

      newlyEnabled.forEach(runScript);
      newlyDisabled.forEach(destroyScript);
    }
  };

  const getInstalledScripts = async function () {
    const url = getURL('/scripts/_index.json');
    const file = await fetch(url);
    const installedScripts = await file.json();

    return installedScripts;
  };

  const notifyOnError = async () => {
    const notificationsPath = getURL('/util/notifications.js');
    const { notify } = await import(notificationsPath);
    window.addEventListener('error', (event) => { notify(`XKit Rewritten error: ${event.message}`); });
    window.addEventListener('unhandledrejection', (event) => { notify(`XKit Rewritten error: ${event.reason}`); });
  };

  const init = async function () {
    const [
      installedScripts,
      { enabledScripts = [] }
    ] = await Promise.all([
      getInstalledScripts(),
      browser.storage.local.get('enabledScripts'),
      documentInteractive
    ]);

    if (!isRedpop()) return;

    await waitForReactLoaded();

    await notifyOnError().catch(console.error);

    $('style.xkit').remove();

    browser.storage.onChanged.addListener(onStorageChanged);

    /**
     * fixes WebKit (Chromium, Safari) simultaneous import failure of files with unresolved top level await
     * @see https://github.com/sveltejs/kit/issues/7805#issuecomment-1330078207
     */
    await Promise.all(['css_map', 'language_data', 'user'].map(name => import(getURL(`/util/${name}.js`))));

    installedScripts
      .filter(scriptName => enabledScripts.includes(scriptName))
      .forEach(runScript);
  };

  const waitForReactLoaded = async () => {
    while (!isReactLoaded()) {
      await new Promise(requestAnimationFrame);
    }
  };

  const documentInteractive = new Promise(resolve =>
    document.readyState === 'loading'
      ? document.addEventListener('readystatechange', resolve, { once: true })
      : resolve()
  );

  init();
}
