import { pageModifications } from '../../utils/mutations.js';
import { keyToCss } from '../../utils/css_map.js';
import { buildStyle } from '../../utils/interface.js';

const labelSelector = `${keyToCss('followingBadgeContainer', 'mutualsBadgeContainer')}:has(> svg)`;

const attr = 'data-subtle-activity-contents';

export const styleElement = buildStyle(`
[${attr}] {
  font-size: 0;
}

[${attr}]::before {
  display: inline-block;
  overflow-x: clip;

  font-size: .78125rem;
  content: attr(${attr});
  width: var(--rendered-width);
}

a:not(:hover) [${attr}]::before {
  width: 0;
}

a:not(:hover) ${labelSelector} > svg {
  margin-left: 0;
}
`);

const transitionStyleElement = buildStyle(`
[${attr}]::before {
  transition: width 0.2s ease;
}
${labelSelector} > svg {
  transition: margin 0.2s ease;
}
`);

const processLabels = labels => labels.forEach(label => {
  label.style.setProperty('--rendered-width', `${label.getBoundingClientRect().width}px`);
  label.setAttribute(attr, label.textContent);
});

const waitForRender = () =>
  new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

export const main = async function () {
  pageModifications.register(labelSelector, processLabels);

  waitForRender().then(() => document.documentElement.append(transitionStyleElement));
};

export const clean = async function () {
  pageModifications.unregister(processLabels);
  transitionStyleElement.remove();

  // todo
};
