import { getCssMap } from '../util/tumblr_helpers.js';
import { buildStyle } from '../util/interface.js';
import { keyToCss } from '../util/css_map.js';

import { pageModifications } from '../util/mutations.js';

const adClass = 'xkit-anti-capitalism';
const hiddenAdClass = 'xkit-anti-capitalism-hidden';

const hiddenAdClass2 = 'xkit-anti-capitalism-hidden-two';

const adSelector2 = getCssMap
  .then(cssMap => ['adTimelineObject', 'instreamAd', 'takeoverBanner']
    .flatMap(key => cssMap[key])
    .map(className => `.${className}`)
    .join(', ')
  );

const styleElement = buildStyle();
const adSelector = getCssMap
  .then(cssMap => ['mrecContainer']
    .flatMap(key => cssMap[key])
    .map(className => `.${className}`)
    .join(', ')
  );

adSelector.then(selector => {
  styleElement.textContent = `${selector} { border: 3px solid orange; }`;
});

const styleElement3 = buildStyle();
const adSelector3 = getCssMap
  .then(cssMap => ['nativeIponWebAd']
    .flatMap(key => cssMap[key])
    .map(className => `.${className}`)
    .join(', ')
  );

adSelector3.then(selector => {
  styleElement3.textContent = `${selector} { border: 3px solid blue; }`;
});

const styleElement2 = buildStyle(`
  .${adClass}:not(.${hiddenAdClass}) { border: 3px solid grey; }
  .${hiddenAdClass} { border: 3px solid red; }

  .${hiddenAdClass2} { opacity: 0.5; outline: 5px solid purple }
`);

const markAds = (adElements) => {
  console.log(adElements);
  adElements.forEach(adElement => {
    adElement.classList.add(adClass);

    // const adText = adElement.innerText.trim();

    // if (!adText || adText === 'Sponsored') {
    //   adElement.classList.add(hiddenAdClass);
    // }
    if (adElement.closest('[data-id]') === null) {
      adElement.classList.add(hiddenAdClass);
    }
  });
};

const adSelector4 = keyToCss('adTimelineObject', 'instreamAd', 'mrecContainer', 'nativeIponWebAd', 'takeoverBanner');

// (async () => {
//   for (const type of ['adTimelineObject', 'instreamAd', 'mrecContainer', 'nativeIponWebAd', 'takeoverBanner']) {
//     console.log(await keyToCss(type));
//   }
//   console.log(await adSelector4);
// })();

const markAds4 = (adElements) => {
  adElements.forEach(adElement => {
    console.log(adElement);
    // adElement.classList.add(adClass);

    // const adText = adElement.innerText.trim();

    // if (!adText || adText === 'Sponsored') {
    //   adElement.classList.add(hiddenAdClass);
    // }
    if (adElement.querySelector('iframe') !== null) {
      console.log(adElement, ' has iframe');
      adElement.classList.add(hiddenAdClass2);
    } else {
      console.log(adElement.outerHTML);
    }
  });
};

const allParents = (element, selector) => {
  const parent = element.parentElement || element.parentNode;
  if (!parent) return [];
  const foundParent = parent.closest(selector);
  if (foundParent) {
    return [foundParent, ...allParents(foundParent, selector)];
  }
  return [];
};

const markAds5 = async (iframes) => {
  const adSelector = await adSelector4;
  iframes.forEach(iframe => {
    const parents = allParents(iframe, adSelector);
    if (parents.length) {
      console.log('this iframe is in', parents);
      parents.forEach(ad => ad.classList.add(hiddenAdClass2));
    } else {
      console.log('wow this iframe is not in an ad', iframe);
    }
  });
};

export const main = async () => {
  document.head.append(styleElement);
  document.head.append(styleElement2);
  document.head.append(styleElement3);
  pageModifications.register(await adSelector2, markAds);
  // pageModifications.register(await adSelector4, markAds4);
  pageModifications.register('iframe', markAds5);
};

export const clean = async () => {
  styleElement.remove();
  styleElement2.remove();
  styleElement3.remove();
  pageModifications.unregister(markAds);
  pageModifications.unregister(markAds4);
  pageModifications.unregister(markAds5);
};
