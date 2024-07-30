import { dom } from '../utils/dom.js';

const bag = dom('div', { id: 'xkit-plastic-bag' });

const onmousemove = event => {
  bag.style = `top: ${event.clientY}px`;
};

export const main = async () => {
  document.documentElement.append(bag);
  document.addEventListener('mousemove', onmousemove);
};

export const clean = async () => {
  document.removeEventListener(onmousemove);
  bag.remove();
  bag.style = '';
};

export const stylesheet = true;
