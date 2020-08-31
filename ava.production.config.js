export default {
    files: [
        '__tests__/production/**/*'
    ],
    environmentVariables: {
        NODE_ENV: 'production',
    },
    concurrency: 5,
    failFast: true,
    failWithoutAssertions: false,
    verbose: true
};