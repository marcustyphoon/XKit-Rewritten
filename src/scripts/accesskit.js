(function () {
  let enabledOptions;

  const runOption = async function (name) {
    const { main: run } = await fakeImport(`/scripts/accesskit/${name}.js`);
    run().catch(console.error);
  };

  const destroyOption = async function (name) {
    const { clean: destroy } = await fakeImport(`/scripts/accesskit/${name}.js`);
    destroy().catch(console.error);
  };

  const onStorageChanged = async function (changes, areaName) {
    if (areaName !== 'local') {
      return;
    }

    if (Object.keys(changes).some(key => key.startsWith('accesskit'))) {
      const { getPreferences } = await fakeImport('/util/preferences.js');
      const preferences = await getPreferences('accesskit');

      const newEnabledOptions = Object.keys(preferences).filter(key => preferences[key] === true);

      const newlyEnabled = newEnabledOptions.filter(x => enabledOptions.includes(x) === false);
      const newlyDisabled = enabledOptions.filter(x => newEnabledOptions.includes(x) === false);

      enabledOptions = newEnabledOptions;

      newlyEnabled.forEach(runOption);
      newlyDisabled.forEach(destroyOption);
    }
  };

  const main = async function () {
    browser.storage.onChanged.addListener(onStorageChanged);
    const { getPreferences } = await fakeImport('/util/preferences.js');

    const preferences = await getPreferences('accesskit');

    enabledOptions = Object.keys(preferences).filter(key => preferences[key] === true);
    enabledOptions.forEach(runOption);
  };

  const clean = async function () {
    enabledOptions.forEach(destroyOption);
  };

  return { main, clean, stylesheet: true };
})();
