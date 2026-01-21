import { defineConfig } from 'tsdown';
import copy from 'rollup-plugin-copy';
import fs from 'node:fs';
import path from 'node:path';
// import manifest from './src/manifest.json' with { type: 'json' };

const withoutExtension = (file: string) => {
  const parsed = path.parse(file);
  return path.join(parsed.dir, parsed.name);
};

export default defineConfig({
  // entry: {
  //   'content_scripts/main': 'src/content_scripts/main.js'
  // },
  entry: Object.fromEntries(
    fs
      .globSync('src/**/*.tsx')
      .map(file => [withoutExtension(path.relative('src', file)), file])
  ),
  outDir: 'dist',
  target: false,
  unbundle: true,
  platform: 'neutral',
  inputOptions: {
    transform: {
      jsx: {
        runtime: 'classic',
        pragma: 'html',
        pure: false
      }
    }
  },
  plugins: [
    copy({
      targets: [
        {
          src: ['src/**/*', '!**/*.tsx'],
          dest: 'dist',
        },
        // {
        //   src: ['src/lib/**/*.js'],
        //   dest: 'dist',
        // }
      ],
      flatten: false
    })
  ]
});
