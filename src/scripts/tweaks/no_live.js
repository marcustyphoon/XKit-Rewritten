import { pageModifications } from '../../util/mutations.js';
import { buildStyle } from '../../util/interface.js';
import { keyToCss } from '../../util/css_map.js';

const hiddenClass = 'xkit-tweaks-no-live-hidden';
const styleElement = buildStyle(`.${hiddenClass} { display: none; }`);

const processFrames = frames =>
  frames.forEach(frame =>
    frame.closest(keyToCss('listTimelineObjectInner'))?.classList?.add(hiddenClass)
  );

export const main = async function () {
  pageModifications.register(
    `[data-timeline="/v2/timeline/dashboard"] :is(iframe[src^="https://api.gateway.tumblr-live.com/"], ${keyToCss('liveMarqueeContainer')}, ${keyToCss('liveMarqueeTitle')})`,
    processFrames
  );
  document.documentElement.append(styleElement);
};

export const clean = async function () {
  pageModifications.unregister(processFrames);
  styleElement.remove();

  $(`.${hiddenClass}`).removeClass(hiddenClass);
};
