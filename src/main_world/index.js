const moduleCache = {};

const key = new URL(import.meta.url).searchParams.get('key');

document.documentElement.addEventListener(`xkit-injection-request-${key}`, async event => {
  const { detail, target } = event;
  const { id, path, args } = JSON.parse(detail);

  try {
    moduleCache[path] ??= await import(path);
    const func = moduleCache[path].default;

    if (target.isConnected === false) return;

    const result = await func.apply(target, args);

    if (result instanceof Element) {
      result.dispatchEvent(
        new CustomEvent(`xkit-injection-element-response-${key}`, { detail: JSON.stringify({ id }), bubbles: true }),
      );
    } else {
      document.documentElement.dispatchEvent(
        new CustomEvent(`xkit-injection-response-${key}`, { detail: JSON.stringify({ id, result }) }),
      );
    }
  } catch (exception) {
    target.dispatchEvent(
      new CustomEvent(`xkit-injection-response-${key}`, {
        detail: JSON.stringify({
          id,
          exception: {
            message: exception.message,
            name: exception.name,
            stack: exception.stack,
            ...exception,
          },
        }),
      }),
    );
  }
});

document.documentElement.dispatchEvent(new CustomEvent(`xkit-injection-ready-${key}`));
