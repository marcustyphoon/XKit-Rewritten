export default function controlPostFormStatus (status, publishOnMs) {
  const button = this;
  const reactKey = Object.keys(button).find(key => key.startsWith('__reactFiber'));

  const isScheduled = status === 'scheduled';
  let fiber = button[reactKey];
  while (fiber !== null) {
    if (fiber.stateNode?.state?.isDatePickerVisible !== undefined) {
      fiber.stateNode.setState({ isDatePickerVisible: isScheduled });
      break;
    } else {
      fiber = fiber.return;
    }
  }

  fiber = button[reactKey];
  while (fiber !== null) {
    if (fiber.stateNode?.setFormPostStatus && fiber.stateNode?.onChangePublishOnValue) {
      fiber.stateNode.setFormPostStatus(status);
      if (status === 'schedule' && publishOnMs) {
        fiber.stateNode.onChangePublishOnValue(new Date(publishOnMs));
      }
      break;
    } else {
      fiber = fiber.return;
    }
  }
}
