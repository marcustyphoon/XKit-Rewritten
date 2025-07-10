import { inject } from './inject.js';

export const customElements = {
  controlButtonContainer: 'xkit-control-button-container',
  modal: 'xkit-modal',
  xkitToasts: 'xkit-toasts',
  xkitSidebar: 'xkit-sidebar'
};

await inject('/main_world/define_custom_elements.js', [customElements]);
