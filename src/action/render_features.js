import { LitElement, css, html, ref } from '../lib/lit-all.min.js';

const configSection = document.getElementById('configuration');
const configSectionLink = document.querySelector('a[href="#configuration"]');
const featuresDiv = configSection.querySelector('.features');

const enabledFeaturesKey = 'enabledScripts';
const specialAccessKey = 'specialAccess';

const getInstalledFeatures = async function () {
  const url = browser.runtime.getURL('/features/index.json');
  const file = await fetch(url);
  const installedFeatures = await file.json();

  return installedFeatures;
};

const handleEnabledInputClick = async function ({ currentTarget }) {
  const { checked, id } = currentTarget;
  const shadowRoot = currentTarget.getRootNode();
  const featureElement = shadowRoot.host;
  let {
    [enabledFeaturesKey]: enabledFeatures = [],
    [specialAccessKey]: specialAccess = []
  } = await browser.storage.local.get();

  const hasPreferences = Object.keys(featureElement.preferences).length !== 0;
  if (hasPreferences) shadowRoot.querySelector('details').open = checked;

  if (checked) {
    enabledFeatures.push(id);
  } else {
    enabledFeatures = enabledFeatures.filter(x => x !== id);

    if (featureElement.deprecated && !specialAccess.includes(id)) {
      specialAccess.push(id);
    }
  }

  featureElement.disabled = !checked;

  browser.storage.local.set({
    [enabledFeaturesKey]: enabledFeatures,
    [specialAccessKey]: specialAccess
  });
};

const debounce = (func, ms) => {
  let timeoutID;
  return (...args) => {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => func(...args), ms);
  };
};

const writePreference = async function ({ target }) {
  const { id } = target;
  const [featureName, preferenceType, preferenceName] = id.split('.');
  const storageKey = `${featureName}.preferences.${preferenceName}`;

  switch (preferenceType) {
    case 'checkbox':
      browser.storage.local.set({ [storageKey]: target.checked });
      break;
    case 'text':
    case 'color':
    case 'select':
    case 'textarea':
      browser.storage.local.set({ [storageKey]: target.value });
      break;
  }
};

const renderPreferences = async function ({ featureName, preferences, preferenceList }) {
  for (const [key, preference] of Object.entries(preferences)) {
    const storageKey = `${featureName}.preferences.${key}`;
    const { [storageKey]: savedPreference } = await browser.storage.local.get(storageKey);
    preference.value = savedPreference ?? preference.default;

    const preferenceTemplateClone = document.getElementById(`${preference.type}-preference`).content.cloneNode(true);

    const preferenceInput = preferenceTemplateClone.querySelector('input, select, textarea, iframe');
    preferenceInput.id = `${featureName}.${preference.type}.${key}`;

    const preferenceLabel = preferenceTemplateClone.querySelector('label');
    if (preferenceLabel) {
      preferenceLabel.textContent = preference.label || key;
      preferenceLabel.setAttribute('for', `${featureName}.${preference.type}.${key}`);
    } else {
      preferenceInput.title = preference.label || key;
    }

    switch (preference.type) {
      case 'text':
      case 'textarea':
        preferenceInput.addEventListener('input', debounce(writePreference, 500));
        break;
      case 'iframe':
        break;
      default:
        preferenceInput.addEventListener('input', writePreference);
    }

    switch (preference.type) {
      case 'checkbox':
        preferenceInput.checked = preference.value;
        break;
      case 'select':
        for (const { value, label } of preference.options) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          option.selected = value === preference.value;
          preferenceInput.appendChild(option);
        }
        break;
      case 'color':
        preferenceInput.value = preference.value;
        $(preferenceInput)
          .on('change.spectrum', writePreference)
          .spectrum({
            preferredFormat: 'hex',
            showInput: true,
            showInitial: true,
            allowEmpty: true
          });
        break;
      case 'iframe':
        preferenceInput.src = preference.src;
        break;
      default:
        preferenceInput.value = preference.value;
    }

    preferenceList.appendChild(preferenceTemplateClone);
  }
};

class XKitFeatureElement extends LitElement {
  // TODO: reflect enabled for investigation purposes—probably don't want to do this?
  static properties = {
    deprecated: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    featureName: { reflect: true },
    help: { reflect: true },
    preferences: { type: Object, reflect: true },
    relatedTerms: { type: Array, reflect: true },
  };

  static styles = css`
    /* TODO: could inline xkit-feature.css here */
  `;

  render () {
    return html`
      <link rel="stylesheet" href="../lib/normalize.min.css">
      <link rel="stylesheet" href="../lib/remixicon/remixicon.css">
      <link rel="stylesheet" href="../lib/spectrum.css">
      <link rel="stylesheet" href="../lib/toggle-button.css">
      <link rel="stylesheet" href="./components/xkit-feature.css">

      <!-- TODO: probably remove these attrs? -->
      <details
        class="feature${this.disabled ? ' disabled' : ''}"
        data-related-terms=${this.relatedTerms}
        ?data-deprecated=${this.deprecated}
      >
        <summary>
          <div class="icon">
            <slot name="icon"></slot>
          </div>
          <div class="meta">
            <h4 class="title"><slot name="title"></slot></h4>
            <p class="description"><slot name="description"></slot></p>
          </div>
          <div class="buttons">
            <a class="help" target="_blank" href=${this.help}}>
              <i class="ri-fw ri-question-fill" style="color:rgb(var(--black))"></i>
            </a>
            <input
              id=${this.featureName}
              type="checkbox"
              ?checked=${!this.disabled}
              class="toggle-button"
              aria-label="Enable this feature"
              @input=${handleEnabledInputClick}
            />
          </div>
        </summary>
        <ul class="preferences" ${ref(preferenceList => renderPreferences({ featureName: this.featureName, preferences: this.preferences, preferenceList }))}></ul>
      </details>
    `;
  }

  // TODO: this could just be in the html and not use slots at all but then what's the point.
  renderChildren ({
    description = '',
    icon = {},
    title = this.featureName
  }) {
    const children = [];

    if (description) {
      const descriptionElement = document.createElement('span');
      descriptionElement.setAttribute('slot', 'description');
      descriptionElement.textContent = description;
      children.push(descriptionElement);
    }

    if (icon.class_name) {
      const iconElement = document.createElement('i');
      iconElement.setAttribute('slot', 'icon');
      iconElement.classList.add('ri-fw', icon.class_name);
      iconElement.style.backgroundColor = icon.background_color ?? '#ffffff';
      iconElement.style.color = icon.color ?? '#000000';
      children.push(iconElement);
    }

    if (title) {
      const titleElement = document.createElement('span');
      titleElement.setAttribute('slot', 'title');
      titleElement.textContent = title;
      children.push(titleElement);
    }

    this.replaceChildren(...children);
  }
}

customElements.define('xkit-feature', XKitFeatureElement);

const renderFeatures = async function () {
  const featureElements = [];

  const installedFeatures = await getInstalledFeatures();
  const {
    [enabledFeaturesKey]: enabledFeatures = [],
    [specialAccessKey]: specialAccess = []
  } = await browser.storage.local.get();

  const orderedEnabledFeatures = installedFeatures.filter(featureName => enabledFeatures.includes(featureName));
  const disabledFeatures = installedFeatures.filter(featureName => enabledFeatures.includes(featureName) === false);

  for (const featureName of [...orderedEnabledFeatures, ...disabledFeatures]) {
    const url = browser.runtime.getURL(`/features/${featureName}/feature.json`);
    const file = await fetch(url);
    const {
      deprecated,
      description,
      help,
      icon,
      preferences,
      relatedTerms,
      title
    } = await file.json();

    const disabled = enabledFeatures.includes(featureName) === false;
    if (disabled && deprecated && !specialAccess.includes(featureName)) {
      continue;
    }

    const featureElement = document.createElement('xkit-feature');
    Object.assign(featureElement, { deprecated, disabled, featureName, help, preferences, relatedTerms });
    featureElement.renderChildren({ description, icon, title });

    featureElements.push(featureElement);
  }

  featuresDiv.replaceChildren(...featureElements);
};

renderFeatures();

configSectionLink.addEventListener('click', ({ currentTarget }) => {
  if (currentTarget.classList.contains('outdated')) {
    currentTarget.classList.remove('outdated');
    renderFeatures();
  }
});
