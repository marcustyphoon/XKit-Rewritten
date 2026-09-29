export default function unburyGifData () {
  const element = this;
  const reactKey = Object.keys(element).find(key => key.startsWith('__reactFiber'));
  let fiber = element[reactKey];

  while (fiber !== null) {
    const { imageResponse, posterImages } = fiber.memoizedProps || {};
    if (Array.isArray(imageResponse) && Array.isArray(posterImages)) {
      return { imageResponse, posterImages };
    } else {
      fiber = fiber.return;
    }
  }
}
