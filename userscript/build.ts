import 'dotenv/config';
import * as esbuild from 'esbuild';
import { globSync } from 'glob';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const getRandomHexString = () => {
  const typedArray = new Uint8Array(8);
  crypto.getRandomValues(typedArray);
  return [...typedArray].map(number => number.toString(16).padStart(2, '0')).join('');
};

const replacements = [
  { from: 'xkit', to: `userscript-${getRandomHexString()}` },
  { from: 'content: "XKit";', to: '/* removed */' },
  { from: 'content: "[XKit] ";', to: '/* removed */' },
  { from: 'XKit Rewritten error', to: 'Userscript error' },
  { from: 'window.tumblr.', to: 'unsafeWindow.tumblr.' }
];

const transform = str =>
  replacements.reduce((prev, cur) => prev.replaceAll(cur.from, cur.to), str);

const existingFiles = new Set(globSync('src/**/*.*', { dot: true }));

const sourceFiles = globSync('../src/{main_world,utils,content_scripts}/**/*.*', { dot: true });
sourceFiles.forEach(filePath => {
  const contents = transform(fs.readFileSync(filePath, 'utf8'));

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

const staticCssFiles = globSync('./src/**/*.css', { dot: true });
const staticCss = staticCssFiles
  .map(filePath => transform(fs.readFileSync(filePath, 'utf8')))
  .join('\n\n');

let name = 'New Tumblr Userscript';

try {
  name = JSON.parse(fs.readFileSync('./src/features/_index.json', 'utf8'))
    .map(str => str.replaceAll('_', ' ').replaceAll(/(?<!\w)./g, char => char.toUpperCase()))
    .join(' / ');
} catch {}

const nameSnake = name.replaceAll(' ', '_').toLowerCase();

const fileNameNoExtension = `${nameSnake}.user`;
const fileName = `${fileNameNoExtension}.js`;

const repo = childProcess.execSync('git config --get remote.origin.url').toString().trim().replace(/.git$/, '');
const currentCommit = childProcess.execSync('git rev-parse HEAD').toString().trim();
const sourceUrl = `${repo}/tree/${currentCommit}/userscript`;

const hasBeenCommitted = childProcess.execSync('git status -s').toString() === '';
const hasBeenPushed = childProcess.execSync('git status').toString().includes("Your branch is up to date with 'origin/");
const published = hasBeenCommitted && hasBeenPushed;

const banner = `
// ==UserScript==
// @name           ${name}
// @namespace      gist.github.com/marcustyphoon
// @version        ${process.env.VERSION ?? '1.0'}
// @author         marcustyphoon
// @match          *://www.tumblr.com/*
// @exclude-match  *://www.tumblr.com/login
// @exclude-match  *://www.tumblr.com/register
// @exclude-match  *://www.tumblr.com/register?*
// @exclude-match  *://www.tumblr.com/privacy/*
// @noframes
// @inject-into    page
// @grant          GM_getValues
// @grant          GM_setValues
// @grant          GM_deleteValues
// @grant          GM_addStyle
// @require        https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js
// @updateURL      ${process.env.GIST_ID ? `https://gist.github.com/marcustyphoon/${process.env.GIST_ID}/raw/${fileName}` : ''}
// @downloadURL    ${process.env.GIST_ID ? `https://gist.github.com/marcustyphoon/${process.env.GIST_ID}/raw/${fileName}` : ''}
// ==/UserScript==

/* eslint-disable */

/*
  Copyright (c) 2020-present marcustyphoon, April Sylph, and XKit Rewritten contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  Source for this script is available at ${published ? sourceUrl + '\n*/' : 'TODO: INSERT URL HERE AND CLOSE THIS COMMENT BLOCK'}

${esbuild.transformSync(fs.readFileSync('./global.js', 'utf8'), { minify: true }).code}
`;

const footer = `GM_addStyle(\`${
  esbuild.transformSync(staticCss, { loader: 'css', minify: true }).code
}\`);`;

esbuild.build({
  entryPoints: ['src/content_scripts/main.js'],
  entryNames: fileNameNoExtension,
  bundle: true,
  format: 'esm',
  outdir: 'output',
  banner: { js: banner.trim() },
  footer: { js: footer },
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true
});
