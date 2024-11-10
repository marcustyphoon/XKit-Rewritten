import 'dotenv/config';
import assert from 'node:assert';
import childProcess from 'node:child_process';
import fs from 'node:fs';

const gistId = process.env.GIST_ID;
assert(gistId, 'No gist ID specified!');

const hasBeenCommitted = childProcess.execSync('git status -s').toString() === '';
const hasBeenPushed = childProcess
  .execSync('git status')
  .toString()
  .includes("Your branch is up to date with 'origin/");
const published = hasBeenCommitted && hasBeenPushed;
assert(published, 'Please commit and push first!');

const files = fs.readdirSync('./output').filter(filePath => filePath !== '.gitignore');
assert(files.length === 1, 'Multiple files in output folder!');

const file = files[0];
const contents = fs.readFileSync(`./output/${file}`, 'utf8');

assert(
  contents.includes('Source for this script is available at https://github.com/'),
  'Missing source attribution!'
);

try {
  const remoteContents = await fetch(
    `https://gist.github.com/marcustyphoon/${gistId}/raw/${file}`
  ).then(response => response.text());

  const remoteVersion = /(?<=@version\s+)\S+/.exec(remoteContents)?.[0];
  const version = /(?<=@version\s+)\S+/.exec(contents)?.[0];

  if (remoteVersion === version) {
    console.warn('WARNING: Uploading with same version number as remote!');
  }
} catch {}

console.log(childProcess.execSync(`gh gist edit ${gistId} -f ${file} ${`./output/${file}`}`).toString());

console.log(`deployed to https://gist.github.com/marcustyphoon/${gistId}`);
console.log(`install from: https://gist.github.com/marcustyphoon/${gistId}/raw/${file}`);
