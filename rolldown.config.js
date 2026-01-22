// @ts-check

import fs from 'node:fs/promises';
import { defineConfig } from 'rolldown';
import copy from 'rollup-plugin-copy';
import watchGlobs from 'rollup-plugin-watch-globs';

const outdir = './dist';

export default defineConfig({
  input: await Array.fromAsync(fs.glob('src/**/*.{jsx,ts,tsx}')),
  output: {
    dir: outdir,
    preserveModules: true,
    preserveModulesRoot: 'src'
  },
  external: () => true,
  treeshake: false,
  transform: {
    jsx: {
      runtime: 'classic',
      pragma: 'jsx',
      pragmaFrag: 'JsxFragment',
      pure: false // omit "pure" annotations
    }
  },
  plugins: [
    watchGlobs(['src/**/*']),
    copy({
      targets: [{ src: ['src/**/*'], dest: outdir }],
      filter: src => !src.match(/\.(ts|tsx|jsx)$/),
      flatten: false
    })
  ]
});
