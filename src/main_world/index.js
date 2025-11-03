const moduleCache = {};

window.removeXKitListener?.();

const controller = new AbortController();
window.removeXKitListener = () => controller.abort();

document.documentElement.addEventListener('xkit-injection-request', async event => {
  const { detail, target } = event;
  const { id, path, args } = JSON.parse(detail);

  try {
    moduleCache[path] ??= import(path).catch(() => importFallback(path));
    const module = await moduleCache[path];
    const func = module.default;

    if (target.isConnected === false) return;

    const result = await func.apply(target, args);
    target.dispatchEvent(
      new CustomEvent('xkit-injection-response', { detail: JSON.stringify({ id, result }) })
    );
  } catch (exception) {
    target.dispatchEvent(
      new CustomEvent('xkit-injection-response', {
        detail: JSON.stringify({
          id,
          exception: {
            message: exception.message,
            name: exception.name,
            stack: exception.stack,
            ...exception
          }
        })
      })
    );
  }
}, { signal: controller.signal });

const importFallback = async path => {
  // This might be a non-standards-compliant browser that only lets web-accessible
  // resources be fetched. Let's try something else!

  console.warn('XKit Rewritten: applying data-uri fetch fallback to', path);

  return fetch(path)
    .then(response => response.text())
    .then(code => `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`)
    .then(dataUri => import(dataUri));
};

document.documentElement.dispatchEvent(new CustomEvent('xkit-injection-ready'));
