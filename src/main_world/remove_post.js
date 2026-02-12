export default function removePost (id) {
  const timelineElement = this;
  const reactKey = Object.keys(timelineElement).find(key => key.startsWith('__reactFiber'));
  let fiber = timelineElement[reactKey];

  while (fiber !== null) {
    const props = fiber.memoizedProps || {};
    if (typeof props?.value?.onRemovePost === 'function') {
      props.value.onRemovePost(id);
      return;
    } else {
      fiber = fiber.return;
    }
  }
}
