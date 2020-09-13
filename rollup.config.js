import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import { eslint } from 'rollup-plugin-eslint';

export default {
  input: './index.ts',
  output: {
    dir: '.',
  },
  plugins: [
    eslint({
      throwOnError: true,
    }),
    json(),
    typescript(),
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
}