export default function triggerScroll () {
  const element = this;
  const reactKey = Object.keys(element).find(key => key.startsWith('__reactFiber'));
  let fiber = element[reactKey];

  while (fiber !== null) {
    const { hasNextPage, fetchNext } = fiber.memoizedProps || {};
    if (hasNextPage && fetchNext) {
      fetchNext(true);
      return;
    } else {
      fiber = fiber.return;
    }
  }
}
