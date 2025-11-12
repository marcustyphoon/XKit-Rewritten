export default function unburyTimelineObject () {
  const timelineElement = this;
  const reactKey = Object.keys(timelineElement).find(key => key.startsWith('__reactFiber'));
  let fiber = timelineElement[reactKey];

  while (fiber !== null) {
    const { endpointApiRequest, timelineModule } = fiber.memoizedProps || {};
    if (endpointApiRequest || timelineModule) {
      console.log('endpointApiRequest', endpointApiRequest);
      console.log('timelineModule', timelineModule);
      return;
    } else {
      fiber = fiber.return;
    }
  }
}
