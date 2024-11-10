import installedScripts from '../features/_index.json';

const redpop = [...document.scripts].some(({ src }) => src.includes('/pop/'));
const isReactLoaded = () => document.querySelector('[data-rh]') === null;

const runScript = async function (name) {
  const {
    main,
    stylesheet,
    styleElement,
    onStorageChanged
  } = await import(`../features/${name}.js`);

  if (main) {
    main().catch(console.error);
  }
  if (stylesheet) {
    // static styles are always inserted
  }
  if (styleElement) {
    styleElement.dataset.feature = name;
    document.documentElement.append(styleElement);
  }

  if (onStorageChanged) {
    console.error(`${name} script error: onStorageChanged is not supported`);
  }
};

const init = async function () {
  installedScripts.forEach(runScript);
};

const waitForReactLoaded = () => new Promise(resolve => {
  window.requestAnimationFrame(() => isReactLoaded() ? resolve() : waitForReactLoaded().then(resolve));
});

if (redpop) {
  isReactLoaded() ? init() : waitForReactLoaded().then(init);
}
