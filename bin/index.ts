import { Boot, Store } from '../index';
import Cli from '../__core__/cli';
import pun from 'please-upgrade-node';
import { Command } from 'commander';
import packageJson from '../package.json';
import { Logger } from 'pino';

let boot: Boot,
    store: Store,
    cache: Store['cache'],
    logger: Logger,
    connections: Store['connections'],
    getInstance: Store['getInstance'],
    getAllInstances: Store['getAllInstances'],
    getInstanceByName: Store['getInstanceByName'],
    getInstancesOfType: Store['getInstancesOfType'],
    getClassByName: Store['getClassByName'],
    register: Store['register'],
    registerBulk: Store['registerBulk'];

(async () => {
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
        boot = new Boot() as Boot;
        await boot.init(undefined, configPath ? {
            configPath,
        } : undefined);
        store = boot.store as Store;
        logger = store.logger as Logger;
        cache = store.cache;
        connections = store.connections;

        // bind all functions
        getInstance =  store.getInstance.bind(store);
        getAllInstances = store.getAllInstances.bind(store);
        getInstancesOfType = store.getInstancesOfType.bind(store);
        register = store.register.bind(store);
        registerBulk = store.registerBulk.bind(store);
        getClassByName = store.getClassByName.bind(store);
        getInstanceByName = store.getInstanceByName.bind(store);
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
})();

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
    connections,
};