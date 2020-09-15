import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import sucrase from '@rollup/plugin-sucrase';
import resolve from '@rollup/plugin-node-resolve';
import { sync } from 'glob';
import { dirname, join } from 'path';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import Throttle from 'promise-parallel-throttle';
import analyze from 'rollup-plugin-analyzer';
import tsConfig from './tsconfig.json';

const simpleFileCache = {};
export default async () => {
  const files = [
    ...tsConfig.files,
    ...tsConfig.include.reduce((arr, dir) => arr = arr.concat(sync(join(dir, '/**', '/*.ts'), {
      ignore: ['node_modules/**', '**/*.d.ts'],
    })), [])
  ];

  await Throttle.all(files.map((file, index) => async () => {
    try {
      const hash = createHash('sha1').update(readFileSync(file)).digest('hex');

      if (simpleFileCache[file] === hash) {
        files.splice(index, 1);
        return;
      }

      simpleFileCache[file] = hash;
    } catch (e) {
      delete simpleFileCache[file];
      files.splice(index, 1);
    }
  }));

  return files.map((file) => ({
    input: file,
    output: {
      dir: dirname(file),
    },
    plugins: [
      analyze(),
      resolve({
        extensions: ['.js', '.ts']
      }),
      preserveShebangs(),
      json(),
      sucrase({
        exclude: ['node_modules/**'],
        transforms: ['typescript', 'imports']
      }),
      terser({
        keep_classnames: true,
        keep_fnames: true,
        mangle: true,
      }),
    ],
    external: [
      'pino',
      'stream',
      'eventemitter2',
      'state-subscriber',
      'please-upgrade-node',
      'commander',
      'path',
      'fs',
      'promise-parallel-throttle',
      'lodash',
      'crypto',
      'node-cron',
      'debug',
      'os',
      'ms',
      'chokidar'
    ],
  }));
};