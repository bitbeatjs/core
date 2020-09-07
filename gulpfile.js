const gulp = require('gulp');
const changedInPlace = require('gulp-changed-in-place');
const ts = require('gulp-typescript');
const terser = require('gulp-terser');
const merge = require('merge-stream');
const eslint = require('gulp-eslint');

const tsProject = ts.createProject('tsconfig.json');
const compileTypeScript = (onlyChanged = true) => {
  let tsResult = tsProject.src();

  if (onlyChanged) {
    tsResult = tsResult.pipe(changedInPlace());
  }

  tsResult = tsResult
      .pipe(eslint())
      .pipe(eslint.format())
      .pipe(eslint.failAfterError())
      .pipe(tsProject());

  return merge(
      tsResult.dts,
      tsResult.js
          .pipe(terser({
            keep_classnames: true,
            keep_fnames: true,
            mangle: true
          }))
  )
      .pipe(gulp.dest(__dirname));
};

gulp.task('default', () => compileTypeScript(false));
gulp.task('changed', () => compileTypeScript());
gulp.task('watch', async () => {
  const files = await new Promise((res, rej) => {
    const stream = tsProject.src();
    const data = [];

    stream.on('data', (file) => {
      data.push(file.path);
    });
    stream.on('end', () => {
      res(data);
    });
    stream.on('error', (err) => {
      rej(err);
    });
  });

  gulp.watch(files, gulp.series('changed'));
});