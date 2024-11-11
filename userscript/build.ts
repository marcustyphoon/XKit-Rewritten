import { Glob } from 'bun';
import * as esbuild from 'esbuild';
import fs from 'node:fs';

const globSync = (str, options) => [...new Glob(str).scanSync(options)];

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

const sourceFiles = globSync('../src/{main_world,utils,content_scripts}/**/*.*', {
  dot: true
});
for (const filePath of sourceFiles) {
  const contents = await Bun.file(filePath).text().then(transform);

  const target = filePath.replace('../', '');
  existingFiles.delete(target);
  await Bun.write(target, contents);
}

const overrides = globSync('overrides/**/*.*', { dot: true });
for (const filePath of overrides) {
  const contents = await Bun.file(filePath).text().then(transform);

  const target = filePath.replace(/^overrides/, 'src');
  existingFiles.delete(target);
  await Bun.write(target, contents);
}

existingFiles.forEach(filePath => {
  if (filePath !== 'src/.gitignore') {
    fs.unlinkSync(filePath);
  }
});

const staticCssFiles = globSync('./src/**/*.css', { dot: true });
const staticCss = await Promise.all(
  staticCssFiles.map(filePath => Bun.file(filePath).text().then(transform))
).then(res => res.join('\n\n'));

let name = 'New Tumblr Userscript';

try {
  name = JSON.parse(fs.readFileSync('./src/features/_index.json', 'utf8'))
    .map(str => str.replaceAll('_', ' ').replaceAll(/(?<!\w)./g, char => char.toUpperCase()))
    .join(' / ');
} catch {}

const banner = `
// ==UserScript==
// @name           ${name}
// @namespace      gist.github.com/marcustyphoon
// @version        1.0
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

  Source for this script is available at
  TODO: INSERT URL HERE AND CLOSE THIS COMMENT BLOCK

${esbuild.transformSync(fs.readFileSync('./global.js', 'utf8'), { minify: true }).code}
`;

const footer = `GM_addStyle(\`${
  esbuild.transformSync(staticCss, { loader: 'css', minify: true }).code
}\`);`;

esbuild.build({
  entryPoints: ['src/content_scripts/main.js'],
  bundle: true,
  format: 'esm',
  outdir: 'output',
  banner: { js: banner.trim() },
  footer: { js: footer },
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true
});
