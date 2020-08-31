export default {
    files: [
        '__tests__/local/**/*'
    ],
    environmentVariables: {
        NODE_ENV: 'local',
    },
    concurrency: 5,
    failFast: true,
    failWithoutAssertions: false,
    verbose: true
};