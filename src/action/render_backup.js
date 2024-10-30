const localExportDisplayElement = document.getElementById('local-storage-export');
const localCopyButton = document.getElementById('copy-local');
const localDownloadButton = document.getElementById('download-local');

const localImportTextarea = document.getElementById('local-storage-import');
const localRestoreButton = document.getElementById('restore-local');
const clearToggleLabel = document.getElementById('clear-toggle-label');
const clearToggle = document.getElementById('clear-toggle');

const sleep = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

let storageLocal = {};

const updateLocalExportDisplay = async function () {
  storageLocal = await browser.storage.local.get();
  const stringifiedStorage = JSON.stringify(storageLocal, null, 2);

  localExportDisplayElement.textContent = stringifiedStorage;
  updateClearToggle();
};

const localCopy = async function () {
  if (localCopyButton.classList.contains('copied')) { return; }

  navigator.clipboard.writeText(localExportDisplayElement.textContent).then(async () => {
    localCopyButton.classList.add('copied');
    await sleep(2000);
    localCopyButton.classList.add('fading');
    await sleep(1000);
    localCopyButton.classList.remove('copied', 'fading');
  });
};

const localExport = async function () {
  storageLocal = await browser.storage.local.get();
  const stringifiedStorage = JSON.stringify(storageLocal, null, 2);
  const storageBlob = new Blob([stringifiedStorage], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(storageBlob);

  const now = new Date();

  const fourDigitYear = now.getFullYear().toString().padStart(4, '0');
  const twoDigitMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const twoDigitDate = now.getDate().toString().padStart(2, '0');

  const dateString = `${fourDigitYear}-${twoDigitMonth}-${twoDigitDate}`;

  const tempLink = document.createElement('a');
  tempLink.href = blobUrl;
  tempLink.download = `XKit Backup @ ${dateString}.json`;

  document.documentElement.appendChild(tempLink);
  tempLink.click();
  tempLink.remove();
  URL.revokeObjectURL(blobUrl);
};

const localRestore = async function () {
  const importText = localImportTextarea.value;

  try {
    localRestoreButton.disabled = true;

    storageLocal = await browser.storage.local.get();

    const parsedStorage = JSON.parse(importText);
    if (typeof parsedStorage !== 'object') throw new Error();

    const oldKeys = Object.keys(storageLocal);
    const newKeys = Object.keys(parsedStorage);
    const staleKeys = oldKeys.filter(key => !newKeys.includes(key));

    if (staleKeys.length && clearToggle.checked) {
      await browser.storage.local.remove(staleKeys);
    }

    await browser.storage.local.set(parsedStorage);

    localRestoreButton.classList.add('success');
    localRestoreButton.textContent = 'Successfully restored!';
    localImportTextarea.value = '';
    clearToggleLabel.dataset.staleKeys = 0;
    document.querySelector('a[href="#configuration"]').classList.add('outdated');
  } catch (exception) {
    localRestoreButton.classList.add('failure');
    localRestoreButton.textContent =
      exception instanceof SyntaxError ? 'Failed to parse backup contents!' : 'Failed to restore!';
    console.error(exception);
  } finally {
    await sleep(3000);
    localRestoreButton.disabled = false;
    localRestoreButton.classList.remove('success', 'failure');
    localRestoreButton.textContent = '';
  }
};

const updateClearToggle = () => {
  const importText = localImportTextarea.value;

  try {
    const parsedStorage = JSON.parse(importText);
    if (typeof parsedStorage !== 'object') throw new Error();

    const oldKeys = Object.keys(storageLocal);
    const newKeys = Object.keys(parsedStorage);
    const staleKeys = oldKeys.filter(key => !newKeys.includes(key));

    clearToggleLabel.dataset.staleKeys = staleKeys.length;
  } catch {
    clearToggleLabel.dataset.staleKeys = 0;
  }
};

const renderLocalBackup = async function () {
  updateLocalExportDisplay();
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      updateLocalExportDisplay();
    }
  });

  localCopyButton.addEventListener('click', localCopy);
  localDownloadButton.addEventListener('click', localExport);

  localImportTextarea.addEventListener('input', updateClearToggle);
  localRestoreButton.addEventListener('click', localRestore);
};

renderLocalBackup();

document.querySelectorAll('#backup details').forEach(details => details.addEventListener('toggle', ({ currentTarget }) => {
  if (currentTarget.open) {
    [...currentTarget.parentNode.children]
      .filter(element => element !== currentTarget)
      .forEach(sibling => { sibling.open = false; });
  }
}));
