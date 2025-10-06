import { getPreferences } from '../../utils/preferences.js';

let enabledFeatures;

const runFeature = async function (name) {
  const { main: run, styleElement } = await import(`./${name}.js`);
  if (run) {
    run().catch(console.error);
  }
  if (styleElement) {
    styleElement.dataset.xkitFeature = `time_machine_${name}`;
    document.documentElement.append(styleElement);
  }
};

const destroyFeature = async function (name) {
  const { clean: destroy, styleElement } = await import(`./${name}.js`);
  if (destroy) {
    destroy().catch(console.error);
  }
  if (styleElement) {
    styleElement.remove();
  }
};

export const onStorageChanged = async function (changes) {
  if (Object.keys(changes).some(key => key.startsWith('time_machine') && changes[key].oldValue !== undefined)) {
    const preferences = await getPreferences('time_machine');

    const newEnabledFeatures = Object.keys(preferences).filter(key => preferences[key] === true);

    const newlyEnabled = newEnabledFeatures.filter(x => enabledFeatures.includes(x) === false);
    const newlyDisabled = enabledFeatures.filter(x => newEnabledFeatures.includes(x) === false);

    enabledFeatures = newEnabledFeatures;

    newlyEnabled.forEach(runFeature);
    newlyDisabled.forEach(destroyFeature);
  }
};

export const main = async function () {
  const preferences = await getPreferences('time_machine');

  enabledFeatures = Object.keys(preferences).filter(key => preferences[key] === true);
  enabledFeatures.forEach(runFeature);
};

export const clean = async function () {
  enabledFeatures.forEach(destroyFeature);
};
