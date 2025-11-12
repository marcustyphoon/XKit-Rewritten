import { keyToCss } from '../../utils/css_map.js';
import { inject } from '../../utils/inject.js';
import { buildStyle } from '../../utils/interface.js';
import { pageModifications } from '../../utils/mutations.js';

export const styleElement = buildStyle(`
${keyToCss('wrapper')} ${keyToCss('newPostIndicator')} {
  display: none;
}
`);

export const main = async () => {
  pageModifications.register(keyToCss('timeline'), timelineElements =>
    timelineElements.forEach(async timelineElement => {
      await inject('/main_world/unbury_timeline_data.js', [], timelineElement);
    })
  );
};
