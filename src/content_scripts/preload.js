'use strict';

{
  const { getURL } = browser.runtime;
  const isRedpop = () => [...document.scripts].some(({ src }) => src.includes('/pop/'));

  const importJson = path => import(path, { with: { type: 'json' } }).then(module => module.default);

  // const getInstalledScripts = async function () {
  //   const url = getURL('/scripts/_index.json');
  //   const file = await fetch(url);
  //   const installedScripts = await file.json();

  //   return installedScripts;
  // };

  const installedUtils = [
    'cleanup',
    'control_buttons',
    'crypto',
    'css_map',
    'debounce',
    'dom',
    'hide_posts',
    'icons',
    'inject',
    'interface',
    'language_data',
    'meatballs',
    'mega_editor',
    'memoize',
    'modals',
    'mutations',
    'notifications',
    'post_actions',
    'post_popovers',
    'preferences',
    'react_props',
    'sidebar',
    'text_format',
    'timeline_id',
    'tumblr_helpers',
    'user',
  ];

  const createPreloadLinkElement = path =>
    Object.assign(document.createElement('link'), {
      href: getURL(path),
      rel: 'modulepreload',
      as: 'script',
      crossOrigin: 'anonymous',
    });

  const preload = async function () {
    const [
      installedScripts,
      { enabledScripts = [] },
    ] = await Promise.all([
      importJson('../scripts/_index.json'),
      browser.storage.local.get('enabledScripts'),
      documentInteractive,
    ]);

    // await documentInteractive;

    if (!isRedpop()) return;

    const installedEnabledScripts = installedScripts
      .filter(name => enabledScripts.includes(name));

    document.head.append(
      ...installedEnabledScripts.map(name => createPreloadLinkElement(`/scripts/${name}.js`)),
      ...installedUtils.map(name => createPreloadLinkElement(`/utils/${name}.js`)),
    );
  };

  const documentInteractive = new Promise(resolve =>
    document.readyState === 'loading'
      ? document.addEventListener('readystatechange', resolve, { once: true })
      : resolve(),
  );

  preload();
}
