import 'dotenv/config';
import { unzipSync } from 'fflate';
import assert from 'node:assert';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// note: before running this, either run
// npx web-ext sign --channel unlisted --api-key [] --api-secret []
// and wait for an approval, or upload with the amo web ui and place signed xpi in /web-ext-artifacts

const decoder = new TextDecoder();

const gistId = process.env.GIST_ID;
assert(gistId, 'No gist ID specified!');

const files = fs
  .readdirSync('./web-ext-artifacts')
  .filter(filePath => filePath.endsWith('.xpi'));
assert(files.length === 1, 'Multiple xpi files in output folder! Delete all but the latest.');

const file = files[0];
const contents = fs.readFileSync(`./web-ext-artifacts/${file}`);
const manifest = JSON.parse(decoder.decode(unzipSync(contents)['manifest.json']));

const {
  name,
  version,
  browser_specific_settings: {
    gecko: { id, update_url: updateUrl }
  }
} = manifest;

const nameKebab = name.replaceAll(' ', '-').toLowerCase();

try {
  const remoteUpdateData = await fetch(updateUrl).then(response => response.json());
  const {
    addons: {
      [id]: {
        updates: [{ version: remoteVersion }]
      }
    }
  } = remoteUpdateData;

  console.log({ remoteVersion, version });

  if (remoteVersion === version) {
    console.warn('WARNING: Uploading with same version number as remote!');
  }
} catch {}

const uploadXpiName = `${nameKebab}-${version}.xpi`;
const xpiInstallUrl = `https://gist.github.com/marcustyphoon/${gistId}/raw/${uploadXpiName}`;

const updateData = {
  addons: {
    [id]: {
      updates: [{ version, update_link: xpiInstallUrl }]
    }
  }
};

const gitDir = `../../gists/${gistId}`;

if (fs.existsSync(gitDir)) {
  fs.writeFileSync(`${gitDir}/${uploadXpiName}`, contents, { flag: 'w+' });
  fs.writeFileSync(
    `${gitDir}/${path.basename(updateUrl)}`,
    JSON.stringify(updateData, null, 2),
    { flag: 'w+' }
  );

  childProcess.spawnSync(`cd ${gitDir}; github .`, { shell: true }).toString();

  console.log(
    `opened github desktop; ready to push to https://gist.github.com/marcustyphoon/${gistId}`
  );
} else {
  console.error(
    `Please clone https://gist.github.com/marcustyphoon/${gistId} (https://gist.github.com/${gistId}.git) to`,
    gitDir
  );
}
