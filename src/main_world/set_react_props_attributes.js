const attr = 'data-xkit-props';
// const firstAttr = 'data-xkit-first-props';

const keyBlacklist = ['children', 'value', 'className', 'data-testid'];
const keyEndingBlacklist = ['Context'];
const maxStringValueLength = 100;

export default function setReactPropsAttributes () {
  [...document.getElementById('root').querySelectorAll(`:not([${attr}])`)].forEach(element => {
    const reactKey = Object.keys(element).find(key => key.startsWith('__reactFiber'));
    let fiber = element[reactKey]?.return;

    const result = [];
    while (fiber && typeof fiber.type !== 'string') {
      const props = Object.entries(fiber.memoizedProps || {})
        .map(([key, value]) => {
          if (
            typeof key !== 'string' ||
            keyBlacklist.includes(key) ||
            keyEndingBlacklist.some(ending => key.endsWith(ending))
          ) {
            return false;
          }
          if (typeof value === 'number') return `${key}:${value}`;
          if (typeof value === 'boolean') return `${key}:${value}`;
          if (typeof value === 'string' && value.length <= maxStringValueLength) {
            return `${key}:${encodeURIComponent(value)}`;
          }
          return `${key}:`;
        })
        .filter(Boolean)
        .join('/');
      props && result.push(`/${props}/`);
      fiber = fiber.return;
    }
    // result.length > 0 && element.setAttribute(firstAttr, result[0]);
    element.setAttribute(attr, result.join('-'));
  });
}

/*
export default function setReactPropsAttributes () {
  [...document.querySelectorAll(`:not([${attr}])`)].forEach(element => {
    const reactKey = Object.keys(element).find(key => key.startsWith('__reactFiber'));
    let fiber = element[reactKey]?.return;

    let result = '';
    while (fiber && typeof fiber.type !== 'string') {
      try {
        const stringified = JSON.stringify(fiber.memoizedProps || {}, (key, value) =>
          key === 'children' || value instanceof Function || value instanceof Element ? undefined : value
        );
        if (stringified !== '{}') {
          result = stringified;
          break;
        }
      } catch {}
      fiber = fiber.return;
    }
    element.setAttribute(attr, result);
  });
}
*/
