import 'dotenv/config';
import { globSync } from 'glob';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = childProcess
  .execSync('git config --get remote.origin.url')
  .toString()
  .trim()
  .replace(/.git$/, '');
const currentCommit = childProcess.execSync('git rev-parse HEAD').toString().trim();
const sourceUrl = `${repo}/tree/${currentCommit}/standalone`;

const hasBeenCommitted = childProcess.execSync('git status -s').toString() === '';
const hasBeenPushed = childProcess
  .execSync('git status')
  .toString()
  .includes("Your branch is up to date with 'origin/");
const published = hasBeenCommitted && hasBeenPushed;

if (!published) {
  console.warn('Warning: Not committed and pushed! Using generic source URL.');
}
const sourceLink = published ? sourceUrl : `${repo}/tree/standalone`;

let name = 'New Tumblr Userscript';

try {
  name = JSON.parse(fs.readFileSync('./overrides/features/_index.json', 'utf8'))
    .map(str => str.replaceAll('_', ' ').replaceAll(/(?<!\w)./g, char => char.toUpperCase()))
    .join(' ');
} catch {}

const nameKebab = name.replaceAll(' ', '-').toLowerCase();
const nameCamel = name.replaceAll(' ', '');

const linksSection = `
      <section id="links">
        <h4>Source</h4>
        <ul>
          <li><a href="${sourceLink}" target="_blank">Source code</a><small id="version"></small></li>
      </section>`;

const replacements = [
  { from: /\s+styleElement.dataset.xkitFeature = .*/g, to: '' },
  { from: /(?<=dataset\.)xkit/g, to: `${nameCamel}Extension` },
  { from: /xkit(?![A-Z])/g, to: `${nameKebab}-extension` },
  { from: /\s+content: "XKit";/g, to: '' },
  { from: /\s+content: "\[XKit\] ";/g, to: '' },
  { from: 'XKit Rewritten error', to: 'Userscript error' },
  { from: /\s+<section id="links">.*?<\/section>/gs, to: linksSection },
  { from: 'XKit Rewritten', to: name },
  { from: 'XKit Control Panel', to: `${name} Control Panel` },
  { from: 'XKit Backup @', to: `${name} Backup @` },
  { from: 'XKit: ', to: `${name}: ` },
  { from: 'removeXKitListener', to: `remove${nameCamel}Listener` },

  { from: /(?<="help": ")https:\/\/github.com\/AprilSylph.*?(?=")/g, to: '' },
  { from: /\s+\.script \.help:not\(\[href\]\)::before \{.*?\}/gs, to: '' },

  { from: '[add-on id]', to: `${nameKebab}-1@marcustyphoon` },
  { from: '[add-on version]', to: process.env.VERSION ?? '0.0.1' },
  {
    from: '"update_url": "[update url]",',
    to: process.env.GIST_ID
      ? `"update_url": "https://gist.githubusercontent.com/marcustyphoon/${process.env.GIST_ID}/raw/update.json",`
      : ''
  }
];

if (process.env.ALWAYS_ENABLED) {
  replacements.push(...[
    { from: /(?<=<input type="checkbox" class="toggle-button" aria-label="Enable this feature")/g, to: ' style="display:none;"' },
    { from: 'enabledScripts.includes(scriptName)', to: '!!enabledScripts' }
  ]);
}

const transform = str =>
  replacements.reduce((prev, cur) => prev.replaceAll(cur.from, cur.to), str);

const existingFiles = new Set(globSync('src/**/*.*', { dot: true }));

const sourceFiles = globSync('../src/**/*.*', { dot: true });
sourceFiles.forEach(filePath => {
  if (filePath.startsWith('../src/features')) return;

  if (filePath.startsWith('../src/icons')) return;
  const isLib = filePath.startsWith('../src/lib');

  const contents = isLib
    ? fs.readFileSync(filePath)
    : transform(fs.readFileSync(filePath, 'utf8'));

  const target = filePath.replace('../', '');
  existingFiles.delete(target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, { flag: 'w+' });
});

const overrides = globSync('overrides/**/*.*', { dot: true });
overrides.forEach(filePath => {
  const contents = transform(fs.readFileSync(filePath, 'utf8'));

  const target = filePath.replace(/^overrides/, 'src');
  existingFiles.delete(target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, { flag: 'w+' });
});

existingFiles.forEach(filePath => {
  if (filePath !== 'src/.gitignore') {
    fs.unlinkSync(filePath);
  }
});
