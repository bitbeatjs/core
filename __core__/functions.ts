/**
 * Get an environment variable parsed.
 */
const getEnvVar = (
    name: string,
    convertToBoolean = false
): any | boolean | undefined => {
    name = name.toUpperCase();

    if (
        !~name.toLowerCase().indexOf('bitbeat') &&
        (process.env.BITBEAT_SCOPED?.toLowerCase() === 'true' ||
            process.env.BITBEAT_SCOPED === '1')
    ) {
        name = `BITBEAT_${name.toUpperCase()}`;
    }

    if (!Object.prototype.hasOwnProperty.call(process.env, name)) {
        return;
    }

    if (convertToBoolean) {
        return (
            process.env[name]?.toLowerCase() === 'true' ||
            process.env[name] === '1'
        );
    }

    let value = process.env[name] || '';
    try {
        value = JSON.parse(value);
    } catch (e) {
        // don't do anything;
    }
    return value;
};

export { getEnvVar };
