#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const license = fs
  .readFileSync('node_modules/remixicon/fonts/remixicon.symbol.svg', { encoding: 'utf8' })
  .match(/<!--.*-->/s).at(0);

fs.globSync('src/features/*/feature.json').forEach(match => {
  const feature = JSON.parse(fs.readFileSync(match));
  const id = feature.icon?.class_name?.replace(/^ri-/, '');
  if (id) {
    const iconPath = fs.globSync(`node_modules/remixicon/icons/*/${id}.svg`).at(0);
    const svgText = fs.readFileSync(iconPath, { encoding: 'utf8' });
    fs.writeFileSync(
      path.join(path.dirname(match), 'icon.svg'),
      [license, '<!--', `Source: ${iconPath}`, '-->', svgText, ''].join('\n'),
    );
  }
});
