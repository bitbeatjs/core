import pun from 'please-upgrade-node';
import { Command } from 'commander';
import { Logger } from 'pino';
import { resolve } from 'path';
import packageJson from '../package.json';
import Boot from '../__core__/boot';
import Events from '../__core__/events';
import Status from '../__core__/status';
import Store from '../__core__/store';
import Cli from '../__core__/cli';

let boot: Boot,
    store: Store,
    cache: Store['cache'],
    logger: Logger,
    getInstance: Store['getInstance'],
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
    getInstance,
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
        getInstance = store.getInstance.bind(store);
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
        const bootFilePath = resolve(boot.baseDir, './boot.js');
        let bootFile;
        try {
            bootFile = await import(bootFilePath);
        } catch (e) {
            store.logger.warn(
                `Boot file '${bootFilePath}' not found. Skipped registering.`
            );
            boot.debug(
                `Boot file '${bootFilePath}' not found. Skipped registering.`
            );
            boot.next(Events.status, Status.registered);
            return;
        }

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
    new Command(packageJson.name)
        .command('start')
        .option(
            '-c, --config <path-to-config>',
            'set a config file for bitbeat to use'
        )
        .usage(`(${commands.join('|')}) [options]`)
        .action(async (options) => {
            await initBoot(options.config);
            await new Cli({
                start: async () => await boot.start(store),
                restart: async () => await boot.restart(store),
                shutdown: async () => await boot.shutdown(store),
                timeout: 10000,
            });
        })
        .allowUnknownOption()
        .parse(process.argv);
};
