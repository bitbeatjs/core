const { watch, task, series, dest, src } = require('gulp');
const changedInPlace = require('gulp-changed-in-place');
const ts = require('gulp-typescript');
const terser = require('gulp-terser');
const merge = require('merge-stream');
const eslint = require('gulp-eslint');
const clean = require('gulp-clean');
const tsconfig = require('./tsconfig.json');

const tsProject = ts.createProject('./tsconfig.json');
const getFiles = async () => {
    return new Promise((res, rej) => {
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
};
const cleanJsAndDeclarations = async () => {
    return src(
        (await getFiles()).reduce((arr, file) => {
            const fileName = file.replace('.ts', '');
            arr = arr.concat([`${fileName}.js`, `${fileName}.d.ts`]);
            return arr;
        }, []),
        {
            allowEmpty: true,
        }
    ).pipe(clean());
};
const compileTypeScript = (onlyChanged = true) => {
    let tsResult = tsProject.src();

    if (onlyChanged) {
        tsResult = tsResult.pipe(changedInPlace());
    }

    tsResult = tsResult
        .pipe(eslint())
        .pipe(eslint.failAfterError())
        .pipe(tsProject());

    return merge([
        tsResult.dts,
        tsResult.js.pipe(
            terser({
                keep_classnames: true,
                keep_fnames: true,
                mangle: true,
            })
        ),
    ]).pipe(dest(tsconfig.compilerOptions.outDir));
};
const compileIncrementalFiles = () => compileTypeScript();
const compileAllFiles = () => compileTypeScript(false);
const watchFiles = async () =>
    watch(await getFiles(), series([compileIncrementalFiles]));

task('default', series([cleanJsAndDeclarations, compileAllFiles]));
task('watch', series([task('default'), watchFiles]));
