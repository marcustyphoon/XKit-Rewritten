{
  const { dataset } = document.currentScript;

  const apiFetch = async (resource, init = {}) => {
    // add XKit header to all API requests
    init.headers ??= {};
    init.headers['X-XKit'] = '1';

    // convert all keys in the body to snake_case
    if (init.body !== undefined) {
      const objects = [init.body];

      while (objects.length !== 0) {
        const currentObjects = objects.splice(0);

        currentObjects.forEach(obj => {
          Object.keys(obj).forEach(key => {
            const snakeCaseKey = key
              .replace(/^[A-Z]/, match => match.toLowerCase())
              .replace(/[A-Z]/g, match => `_${match.toLowerCase()}`);

            if (snakeCaseKey !== key) {
              obj[snakeCaseKey] = obj[key];
              delete obj[key];
            }
          });
        });

        objects.push(
          ...currentObjects
            .flatMap(Object.values)
            .filter(value => value instanceof Object)
        );
      }
    }

    return window.tumblr.apiFetch(resource, init);
  };

  apiFetch(...JSON.parse(dataset.arguments))
    .then(result => { dataset.result = JSON.stringify(result ?? null); })
    .catch(exception => {
      dataset.exception = JSON.stringify({
        message: exception.message,
        name: exception.name,
        stack: exception.stack,
        ...exception
      });
    });
}