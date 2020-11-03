import Boot from '../__core__/boot';
import Cli from '../__core__/cli';
import Events from '../__core__/events';
import Status from '../__core__/status';
import Store from '../__core__/store';
import packageJson from '../package.json';
import pun from 'please-upgrade-node';
import { Command } from 'commander';
import { Logger } from 'pino';
import { existsSync } from 'fs';
import { resolve } from 'path';

let boot: Boot,
    store: Store,
    cache: Store['cache'],
    logger: Logger,
    debugLog: Store['debugLog'],
    generateDebugger: Store['generateDebugger'],
    getInstance: Store['getInstance'],
    getInstancesWithMinVersion: Store['getInstancesWithMinVersion'],
    getAllInstances: Store['getAllInstances'],
    getInstanceByName: Store['getInstanceByName'],
    getInstancesOfType: Store['getInstancesOfType'],
    register: Store['register'],
    unregister: Store['unregister'],
    unregisterBulk: Store['unregisterBulk'],
    registerBulk: Store['registerBulk'],
    registerUpdate: Store['registerUpdate'];

// export the static method without using Boot.
export {
    boot,
    store,
    logger,
    cache,
    debugLog,
    generateDebugger,
    getInstance,
    getInstancesWithMinVersion,
    getAllInstances,
    getInstancesOfType,
    getInstanceByName,
    register,
    registerBulk,
    unregister,
    unregisterBulk,
    registerUpdate,
};

export default async (): Promise<void> => {
    // check the package version
    pun(packageJson, {
        message(requiredVersion) {
            return `${packageJson.name} requires at least node version ${requiredVersion} (current: ${process.version}).`;
        },
    });

    // all available commands
    const commands = ['start'];

    // the basic init boot function to export always the update
    const initBoot = async (configPath: string): Promise<void> => {
        boot = new Boot();
        await boot.init(
            undefined,
            configPath
                ? {
                      configPath,
                  }
                : undefined
        );
        store = boot.store as Store;
        logger = store.logger as Logger;
        cache = store.cache;

        // rebind all functions to the store
        debugLog = store.debugLog.bind(store);
        generateDebugger = store.generateDebugger.bind(store);
        getInstance = store.getInstance.bind(store);
        getInstancesWithMinVersion = store.getInstancesWithMinVersion.bind(
            store
        );
        getAllInstances = store.getAllInstances.bind(store);
        getInstancesOfType = store.getInstancesOfType.bind(store);
        register = store.register.bind(store);
        registerBulk = store.registerBulk.bind(store);
        unregister = store.unregister.bind(store);
        unregisterBulk = store.unregisterBulk.bind(store);
        registerUpdate = store.registerUpdate.bind(store);
        getInstanceByName = store.getInstanceByName.bind(store);

        // add the boot files
        boot.next(Events.status, Status.registering);
        const bootFilePath =
            boot.getConfig().bootFile || resolve(boot.baseDir, './boot.js');
        let bootFile;
        const jsExists = existsSync(bootFilePath);

        // check if the js version of boot is existing
        if (!jsExists) {
            const tsFile = bootFilePath.replace(/\.js/gi, '.ts');
            const typeScriptExists = existsSync(tsFile);

            if (typeScriptExists) {
                store.logger.warn(
                    `Boot file '${tsFile}' found. Have you build it?`
                );
                boot.debug(`Boot file '${tsFile}' found. Have you build it?`);
            }

            store.logger.warn(
                `Boot file '${bootFilePath}' not found. Skipped registering.`
            );
            boot.debug(
                `Boot file '${bootFilePath}' not found. Skipped registering.`
            );
            boot.next(Events.status, Status.registered);
            return;
        }

        // try to import the content
        try {
            bootFile = await import(bootFilePath);
        } catch (e) {
            store.logger.warn(
                `Issue while loading '${bootFilePath}'. Skipped registering.`
            );
            boot.debug(
                `Issue while loading '${bootFilePath}'. Skipped registering.`
            );
            boot.next(Events.status, Status.registered);
            return;
        }

        // and run the registers
        try {
            const bootFunction = bootFile['default'];

            if (!bootFunction) {
                throw new Error(
                    'Could not start default boot function. Did you use module.exports correctly?'
                );
            }

            await bootFunction();
        } catch (e) {
            store.logger.error(e.toString());
            boot.debug(e.toString());
            process.exit(1);
        }

        boot.next(Events.status, Status.registered);
    };

    // run the cli tool
    const program = new Command(packageJson.name).version(packageJson.version);

    const startUp = async (options: any) => {
        if (options.local) {
            process.env.NODE_ENV = 'local';
        }

        if (options.production) {
            process.env.NODE_ENV = 'production';
        }

        await initBoot(options.config);
        await new Cli({
            start: async () => await boot.start(store),
            restart: async () => await boot.restart(store),
            shutdown: async () => await boot.shutdown(store),
            timeout: 10000,
        });
    };

    // add the start command
    program
        .command('start', {
            isDefault: true,
        })
        .alias('run')
        .description('Start an instance of bitbeat.')
        .option(
            '-c, --config <path-to-config>',
            'set a config file for bitbeat to use'
        )
        .option('-l, --local', 'set the node env to local for the run quickly')
        .option(
            '-p, --production',
            'set the node env to production for the run quickly (by default)'
        )
        .usage(`(${commands.join('|')}) [options]`)
        .action(async (options) => {
            await startUp(options);
        });

    // add the debug command
    program
        .command('debug')
        .alias('inspect')
        .alias('dev')
        .description('Debug an instance of bitbeat.')
        .option(
            '-c, --config <path-to-config>',
            'set a config file for bitbeat to use'
        )
        .option('-l, --local', 'set the node env to local for the run quickly')
        .option(
            '-p, --production',
            'set the node env to production for the run quickly (by default)'
        )
        .usage(`(${commands.join('|')}) [options]`)
        .action(async (options) => {
            process.env.BITBEAT_DEBUG = 'true';
            await startUp(options);
        });

    // some default executions
    program.allowUnknownOption().parse(process.argv);
};
