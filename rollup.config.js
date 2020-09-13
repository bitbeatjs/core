import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import { eslint } from 'rollup-plugin-eslint';
import sucrase from '@rollup/plugin-sucrase';
import resolve from '@rollup/plugin-node-resolve';
import { glob } from 'glob';
import { dirname } from 'path';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';

export default new Promise((res) => {
  let config = [];
  glob('**/*.ts', {
    ignore: ['node_modules/**', '**/*.d.ts'],
  }, (err, matches) => {
    console.log(matches)
    config = config.concat(matches.map((file) => ({
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
    })));
    console.log(config);
    res(config);
  });
});