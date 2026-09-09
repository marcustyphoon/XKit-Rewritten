#!/usr/bin/env node
/* eslint-disable no-template-curly-in-string */

import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

// npm i -D eslint-plugin-unused-imports
import unusedImports from 'eslint-plugin-unused-imports';

const eslint = new ESLint({ fix: true, overrideConfigFile: true, overrideConfig: [{ plugins: { 'unused-imports': unusedImports }, rules: { 'no-unused-vars': 'off', 'unused-imports/no-unused-imports': 'error' } }] });

const regex = (string, loose = false) => new RegExp(
  RegExp.escape(string)
    .replace('extract', loose ? '([^)]+)' : '([a-zA-Z-]+)')
    .replaceAll('extract', '\\1'),
  'g',
);

fs.globSync('src/features/**/*.js').forEach(async filePath => {
  const contents = fs.readFileSync(filePath, 'utf8');
  let newContents = contents
    .replaceAll(regex("$('#extract').remove();"), "removeElementsById('$1');")
    .replaceAll(regex('$(`#${extract}`).remove();'), 'removeElementsById($1);')

    .replaceAll(regex('$(`.${extract}`).remove();'), 'removeElementsByClassName($1);')
    .replaceAll(regex("$('.extract').remove();"), "removeElementsByClassName('$1');")

    .replaceAll(regex('$(`[${extract}]`).remove();'), 'removeElementsByAttribute($1);')
    .replaceAll(regex("$('[extract]').remove();"), "removeElementsByAttribute('$1');")

    .replaceAll(regex('$(`[${extract}]`).removeAttr(extract);'), 'removeAttribute($1);')
    .replaceAll(regex("$('[extract]').removeAttr('extract');"), "removeAttribute('$1');")
    .replaceAll(regex('$(`.${extract}`).removeClass(extract);'), 'removeClassName($1);')
    .replaceAll(regex("$('.extract').removeClass('extract');"), "removeClassName('$1');")

    .replaceAll(regex('$(extract).remove();', true), 'removeElementsBySelector($1);');

  if (newContents !== contents) {
    newContents =
    `import { removeAttribute, removeChildrenByAttribute, removeClassName, removeElementsByAttribute, removeElementsByClassName, removeElementsById, removeElementsBySelector } from '${path.relative(path.dirname(filePath), 'src/utils/cleanup.js')}';` +
        '\n' +
        newContents;

    fs.writeFileSync(
      filePath,
      (await eslint.lintText(newContents))[0].output,
      { flag: 'w+' },
    );
    // childProcess.execFileSync('npx', ['organize-imports-cli', filePath], { stdio: 'inherit' });
  }
});
