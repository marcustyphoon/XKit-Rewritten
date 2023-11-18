const testHeaderElement = (selector, menuElement) => {
  const reactKey = Object.keys(menuElement).find(key => key.startsWith('__reactFiber'));
  let fiber = menuElement[reactKey];

  while (fiber !== null) {
    if (fiber.elementType === 'header') {
      return fiber.stateNode.matches(selector);
    } else {
      fiber = fiber.return;
    }
  }
};

export default testHeaderElement;
