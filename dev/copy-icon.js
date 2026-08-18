#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'util';

const { values: { id, target } } = parseArgs({
  options: {
    id: { type: 'string', short: 'i' },
    target: { type: 'string', short: 't' },
  },
  strict: true,
});
if (!id || !target) {
  console.log('Run this script with --id and --target! Examples:');
  console.log('dev/copy-remix-icon.js --id repeat-line --target src/features/quick_reblog');
  console.log('dev/copy-remix-icon.js --id repeat-line --target src/features/quick_reblog/repeat-line.svg');
  process.exit(1);
}

const iconPath = fs.globSync(`node_modules/remixicon/icons/*/${id}.svg`).at(0);
if (!iconPath) {
  console.log(`Could not find icon file with id ${id}!`);
  process.exit(1);
}

const targetIsFile = !!path.extname(target);
const targetFile = targetIsFile ? target : path.join(target, 'icon.svg');

const dirname = path.dirname(targetFile);
try {
  fs.accessSync(dirname);
} catch {
  console.log(`Could not access path ${dirname}!`);
  process.exit(1);
}

const license = `<!-- https://github.com/Remix-Design/remixicon/blob/master/License | https://remixicon.com/icon/${id} -->`;
const svgText = fs.readFileSync(iconPath, { encoding: 'utf8' });

fs.writeFileSync(
  targetFile,
  [license, svgText, ''].join('\n'),
);
