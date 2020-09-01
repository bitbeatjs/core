import { Boot, Events, Status, Store, Cli } from '../index';
import pun from 'please-upgrade-node';
import { Command } from 'commander';
import packageJson from '../package.json';
import { Logger } from 'pino';
import { resolve } from 'path';

let boot: Boot,
    store: Store,
    cache: Store['cache'],
    logger: Logger,
    getInstance: Store['getInstance'],
    getAllInstances: Store['getAllInstances'],
    getInstanceByName: Store['getInstanceByName'],
    getInstancesOfType: Store['getInstancesOfType'],
    getClassByName: Store['getClassByName'],
    register: Store['register'],
    unregister: Store['unregister'],
    unregisterBulk: Store['unregisterBulk'],
    registerBulk: Store['registerBulk'],
    registerUpdate: Store['registerUpdate'];

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
    const initBoot = async (configPath: string) => {
        boot = new Boot();
        await boot.init(undefined, configPath ? {
            configPath,
        } : undefined);
        store = boot.store as Store;
        logger = store.logger as Logger;
        cache = store.cache;

        // rebind all functions to the store
        getInstance =  store.getInstance.bind(store);
        getAllInstances = store.getAllInstances.bind(store);
        getInstancesOfType = store.getInstancesOfType.bind(store);
        register = store.register.bind(store);
        registerBulk = store.registerBulk.bind(store);
        unregister = store.unregister.bind(store);
        unregisterBulk = store.unregisterBulk.bind(store);
        registerUpdate = store.registerUpdate.bind(store);
        getClassByName = store.getClassByName.bind(store);
        getInstanceByName = store.getInstanceByName.bind(store);

        // add the boot files
        boot.next(Events.status, Status.registering);
        let bootFile;
        try {
            bootFile = await import(resolve(boot.baseDir, './boot.js'));
        } catch (e) {
            store.logger.warn('No boot file specified. Skipping registering.');
            boot.next(Events.status, Status.registered);
            return;
        }

        try {
            const bootFunction = bootFile['default'];

            if (!bootFunction) {
                throw new Error('Could not start default boot function. Did you use module.exports correctly?');
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
        .option('-c, --config <path-to-config>', 'set a config file for bitbeat to use')
        .usage(`(${commands.join('|')}) [options]`)
        .action(async options => {
            await initBoot(options.config);
            await new Cli({
                start: async () => await boot.start(store),
                restart: async () => await boot.restart(store),
                shutdown: async () =>
                    await boot.shutdown(store, true),
                timeout: 10000,
            });
        })
        .allowUnknownOption()
        .parse(process.argv);
};

export {
    boot,
    store,
    logger,
    cache,
    getInstance,
    getAllInstances,
    getInstancesOfType,
    getClassByName,
    getInstanceByName,
    register,
    registerBulk,
    unregister,
    unregisterBulk,
    registerUpdate
};