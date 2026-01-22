import { element } from './dom.js';

const fragmentSymbol = Symbol('jsx.js fragment tagname');
globalThis.JsxFragment = fragmentSymbol;

globalThis.jsx = (tagName, properties, ...children) =>
  tagName === fragmentSymbol
    ? children
    : element(tagName, properties || {}, children.flat(Infinity).filter(Boolean));
