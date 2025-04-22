const textInput = document.getElementById('text-input');
const rangeInput = document.getElementById('range-input');

const maxPostWidthStorageKey = 'panorama.maxPostWidth';

const onTextInput = () =>
  browser.storage.local.set({ [maxPostWidthStorageKey]: textInput.value });

const onRangeInput = () =>
  browser.storage.local.set({ [maxPostWidthStorageKey]: `${rangeInput.value}px` });

const debounce = (func, ms) => {
  let timeoutID;
  return (...args) => {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => func(...args), ms);
  };
};

textInput.addEventListener('input', debounce(onTextInput, 500));
rangeInput.addEventListener('input', onRangeInput);

const renderPreference = async () => {
  const {
    [maxPostWidthStorageKey]: maxPostWidthString = '800px'
  } = await browser.storage.local.get(maxPostWidthStorageKey);

  textInput.value = maxPostWidthString;
  rangeInput.value = Number(maxPostWidthString.trim().replace('px', '')) || 0;
};

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && Object.keys(changes).includes(maxPostWidthStorageKey)) {
    renderPreference();
  }
});

renderPreference();
