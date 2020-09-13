import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import { eslint } from 'rollup-plugin-eslint';
import sucrase from '@rollup/plugin-sucrase';
import resolve from '@rollup/plugin-node-resolve';
import { sync } from 'glob';
import { dirname } from 'path';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import Throttle from 'promise-parallel-throttle';

const simpleFileCache = {};
export default async () => {
  const files = sync('**/*.ts', {
    ignore: ['node_modules/**', '**/*.d.ts'],
  });
  await Throttle.all(files.map((file, index) => async () => {
    const hash = createHash('sha1').update(readFileSync(file)).digest('hex');

    if (simpleFileCache[file] === hash) {
      files.splice(index, 1);
      return;
    }

    simpleFileCache[file] = hash;
  }));

  return files.map((file) => ({
    input: file,
    output: {
      dir: dirname(file),
    },
    plugins: [
      resolve({
        extensions: ['.js', '.ts']
      }),
      eslint({
        throwOnError: true,
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