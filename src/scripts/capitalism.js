import { dom } from '../util/dom.js';
import { hideModal, showModal } from '../util/modals.js';

let id;

const showAd = () => {
  showModal({
    title: 'Hey!',
    message: [
      'Have you heard about ',
      dom('a', { href: 'https://protonvpn.com/', target: '_blank' }, null, ['ProtonVPN?']),
      '\n\n',
      dom('small', null, null, ['xkit rewritten ad sponsored by: NO ONE THESE ARE FAKE inc'])
    ],
    buttons: [
      dom('button', { class: 'blue' }, { click: hideModal }, ['Yeah']),
      dom('button', { class: 'blue' }, { click: hideModal }, ['No'])
    ]
  });
  id = setTimeout(showAd, Math.random() * 1000 * 60 * 60 * 24);
};

export const main = async () => {
  id = setTimeout(showAd, Math.random() * 1000 * 60 * 60 * 24);
};
export const clean = async () => {
  clearTimeout(id);
};
