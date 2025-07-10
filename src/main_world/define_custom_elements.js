export default function defineCustomElements (elementTypes) {
  Object.values(elementTypes).forEach(elementName =>
    customElements.define(elementName, class extends HTMLElement {})
  );
}
