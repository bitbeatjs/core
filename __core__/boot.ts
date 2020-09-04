import { readdir, lstatSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as Throttle from 'promise-parallel-throttle';
import { merge, groupBy, reduce } from 'lodash';
import {
    Store,
    Status,
    Middleware,
    BaseStructure,
    Task,
    DirectorySettings,
    Config,
    Events,
} from '../index';
import StateSubscriber from 'state-subscriber';
import {
    version as packageVersion,
    name as packageName,
} from '../package.json';
import { getPriority, NetworkInterfaceInfo, networkInterfaces } from 'os';
import ms from 'ms';
import { Debugger, debug } from 'debug';
import { schedule, validate } from 'node-cron';
import { PackageJson } from 'type-fest';

class Boot extends StateSubscriber {
    public readonly debug: Debugger;
    public readonly version: string = packageVersion;
    public readonly ips: string[];
    public readonly id: string;
    public store: Store | any;
    public readonly logLevel: string = 'info';
    public readonly baseDir: string = resolve('./');
    public readonly coreDir: string = resolve(__dirname, '../');
    public readonly name: string = packageName;
    public projectName = '';
    private config: Config = {
        logDirectory: '',
        directories: {},
    };

    constructor(
        options: {
            baseDir?: string;
            logLevel?: string;
            config?: Config;
            store?: Store;
        } = {}
    ) {
        super();

        if (!process.env.NODE_ENV) {
            process.env.NODE_ENV = 'production';
        }

        // create the debug
        this.debug = this.generateDebugger('boot');

        this.ips = reduce(
            Object.values(Boot.getIPs()),
            (arr: any, item: any) => {
                item.forEach((i: any) => arr.push(i.address));
                return arr;
            },
            [] as any
        ) as any;
        this.ips.reverse();
        const [iFaceItem] = this.ips;
        this.id = iFaceItem;

        if (options.baseDir) {
            this.baseDir = options.baseDir;
        }

        if (options.config) {
            this.config = options.config;
        }

        if (options.logLevel || process.env.LOG_LEVEL) {
            this.logLevel =
                options.logLevel || (process.env.LOG_LEVEL as string);
        }
    }

    /**
     * This will generate you an instance of a debugger in the namespace of the core.
     */
    public generateDebugger(name: string): Debugger {
        const scopedDebugger = debug(`${this.name}:${name}`);

        if (Boot.getEnvVar('BITBEAT_DEBUG', true)) {
            debug.enable(Boot.getEnvVar('BITBEAT_DEBUG_NAMESPACE') || `${this.name}:*`);
        }

        return scopedDebugger;
    }

    /**
     * Init the boot. Should run after the creation and before the start.
     */
    public async init(store: Store = this.store, options?: {
        configPath?: string;
    }): Promise<void> {
        this.next(Events.status, Status.initializing);
        this.config = await this.loadCoreConfig(options?.configPath);
        const projectPackageJson = await this.loadProjectPackage();

        if (!projectPackageJson.name) {
            this.projectName = this.name;
        } else {
            this.projectName = projectPackageJson.name;
        }

        this.debug('Starting boot.');

        this.store =
            store ||
            (new Store(this, {
                instanceName: this.name,
                logLevel: this.logLevel,
            }) as Store);

        this.store.debug('Created store.');
        await this.store.init();
        this.store.debug('Initialized store.');

        // init the start and general states
        const directoryNames = Object.keys(this.config.directories);
        const directoryStarts = directoryNames.filter((dir) => this.config.directories[dir].start);

        directoryNames.forEach((dir) => {
            const name = this.config.directories[dir].statusName;
            this.store.next(`${Events.init}.${name}`, false);
            this.store.next(`${Events.load}.${name}`, false);
            this.store.next(`${Events.provide}.${name}`, false);
        });

        directoryStarts.forEach((dir) => {
            const name = this.config.directories[dir].statusName;
            this.store.next(`${Events.start}.${name}`, false);
        });

        this.debug('Initialized boot.');
        this.next(Events.status, Status.initialized);
    }

    /**
     * Get an environment variable parsed.
     */
    public static getEnvVar(name: string, convertToBoolean = false): any {
        name = name.toUpperCase();

        if (!~name.toLowerCase().indexOf('bitbeat') && (process.env.BITBEAT_SCOPED?.toLowerCase() === 'true' || process.env.BITBEAT_SCOPED === '1')) {
            name = `BITBEAT_${name.toUpperCase()}`;
        }

        if (!process.env[name]) {
            return;
        }

        if (convertToBoolean) {
            return (process.env[name]?.toLowerCase() === 'true' || process.env[name] === '1');
        }

        let value = process.env[name] || '';
        try {
            value = JSON.parse(value);
        } catch (e) {
            // don't do anything;
        }
        return value;
    }

    /**
     * Get the ips of the process.
     */
    private static getIPs(): {
        [iFace: string]: {
            alias?: number;
            address: string;
            internal: boolean;
        }[];
    } {
        const interfaces = networkInterfaces();
        const ips: {
            [iFace: string]: {
                alias?: number;
                address: string;
                internal: boolean;
            }[];
        } = {};

        Object.keys(interfaces).forEach((name) => {
            const iFaces = (interfaces[name] as NetworkInterfaceInfo[])
                .filter(
                    (item) =>
                        item.family === 'IPv4' && item.address !== '127.0.0.1'
                )
                .map((item) => ({
                    address: item.address,
                    internal: item.internal,
                }));

            if (iFaces.length) {
                ips[name] = iFaces;
            }
        });

        return ips;
    }

    /**
     * Will return the config of the boot instance.
     */
    public getConfig(): Config {
        return this.config;
    }

    /**
     * Shut the boot down gracefully.
     */
    public async shutdown(
        store: Store = this.store,
    ): Promise<void> {
        try {
            this.next(Events.status, Status.shutdown);
            store.logger.info('Shutting down...');
            this.debug('Stopping boot.');
            await this.stop(store, false);
            await Throttle.all([...store.getAllInstances()]
              .map((instance) => async () =>
                instance.destroy()));
            await this.removeAllFromFileCache(store);
            this.debug('Stopped boot.');
            store.clearInstances();

            store.logger.info('Exiting...');
            await store.close();
            this.debug('Cleaned up queues and redis.');
            store.debug('Closed store.');
            this.next(Events.status, Status.exit);
            this.debug('Exit boot.');
        } catch (e) {
            store.logger.error(e.message);
            throw e;
        }
    }

    /**
     * Check if has enabled and is enabled.
     */
    private static checkEnabled(instance: BaseStructure): boolean {
        return Object.prototype.hasOwnProperty.call(instance, 'enable') && instance.enable;
    }

    /**
     * Load the project package of the main package.
     */
    private async loadProjectPackage(): Promise<PackageJson> {
        return import(resolve(this.baseDir, './package.json'));
    }

    /**
     * Load the core config.
     */
    private async loadCoreConfig(configPath?: string): Promise<Config> {
        const mainFile = `./bitbeat.config.js`;

        let config: Config = {
            logDirectory: '',
            directories: {},
            fileWatcherDelay: 300,
        };
        try {
            config = (await import(resolve(this.coreDir, mainFile))).default as Config;

            if (this.baseDir !== this.coreDir && configPath) {
                config = merge(config, (await import(resolve(this.baseDir, configPath))).default as Config || {
                    directories: {},
                });
            }
        } catch (e) {
            // don't do anything
        }

        await this.extendConfig(config);
        delete config.extends;

        Object.keys(config.directories).forEach((dir) => {
            if (!config.directories[dir].statusName) {
                config.directories[dir].statusName = dir;
            }
        });

        return config;
    }

    /**
     * Extend the loaded config.
     */
    private async extendConfig(config: Config): Promise<Config> {
        const conf = {
            ...config,
        };
        await Throttle.all((conf.extends || []).map((path) => async () => {
            try {
                const extendingConfig = await this.extendConfig((await import(resolve(path))).default as Config || {
                    directories: {},
                });
                merge(extendingConfig, config);
                merge(conf, extendingConfig);
            } catch (e) {
                // don't do anything
            }
        }), {
            maxInProgress: 1,
        });
        return conf;
    }

    /**
     * Start the instance.
     */
    public async start(
        store: Store = this.store,
        isReboot = false,
        startDirectories?: Set<DirectorySettings>
    ): Promise<void> {
        try {
            this.debug('Starting boot.');
            this.next(Events.status, Status.starting);
            store.logger.info('Starting service...');

            // init status
            store.startTime = Date.now();

            // link all registered to the instances
            store.linkRegistered();

            // load all directories
            await this.startup(isReboot, store, startDirectories);
            store.debug('Loaded store and instances.');

            // update the boot time
            store.bootTime = Date.now();

            // set the status to final
            this.next(Events.status, Status.started);

            // emit the final log
            store.logger.info(`Settings:`);
            store.logger.info(`- name: '${this.name}'.`);
            store.logger.info(`- locale: '${store.i18n.locale}'.`);
            store.logger.info(`- client: '${this.id}'.`);
            store.logger.info(`- version: '${packageVersion}'.`);
            store.logger.info(`- environment: '${process.env.NODE_ENV}'.`);
            store.logger.info(`- log level: '${this.logLevel}'.`);
            store.logger.info(`- pid: '${getPriority()}'.`);

            const title = `STARTED ${packageName.toUpperCase()}`;
            const titleLength = title.length;
            const asciiMiddle = new Array(titleLength).fill('*').join('');
            const filler = new Array(10).fill('*').join('');
            store.logger.info(`${filler}*${asciiMiddle}*${filler}`);
            store.logger.info(`${filler} ${title} ${filler}`);
            store.logger.info(`${filler}*${asciiMiddle}*${filler}`);
            store.logger.info(
                `Service took ${ms(store.getBootTime(), {
                    long: true,
                })} to boot.`
            );
            this.debug('Logged infos.');

            if (!isReboot) {
                store.cache.simple._changedFiles.clear();
                store.cache.simple._changedRegistered.clear();
                store.on('register', async ({ instances, reboot }: {
                    instances: Set<BaseStructure>;
                    reboot: boolean;
                }) => {
                    if (!instances || !instances.size || !reboot) {
                        return;
                    }

                    await this.restart(store);
                });
            }

            // start the watcher
            if (process.env.NODE_ENV !== 'production' && !isReboot) {
                this.watchFiles(store);
                store.next('start.watchers', true);
                store.debug('Started file watcher.');
                this.debug('Started file watcher.');
            }

            this.debug('Finished starting boot.');
        } catch (e) {
            store.logger.error(e.message);
            throw e;
        }
    }

    /**
     * Provide an instance.
     */
    private async provideInstances(
        instances: Set<any>,
        dir: DirectorySettings,
        store: Store = this.store
    ): Promise<void> {
        await Throttle.all(
            [...instances].map((instance) => async () => {
                if (!Boot.checkEnabled(instance)) {
                    return;
                }

                if (!instance.provide) {
                    return;
                }

                instance.next(Events.status, Status.providing);
                this.next(Status.providing, instance);
                const middlewares = this.getMiddlewaresOfInstance(
                  instance,
                  store,
                );
                await Throttle.all(
                    [...middlewares].map((middleware: Middleware) => async () =>
                        middleware.beforeProvide(instance)
                    )
                );
                await instance.provide();
                await Throttle.all(
                    [...middlewares].map((middleware: Middleware) => async () =>
                        middleware.afterProvide(instance)
                    )
                );
                instance.next(Events.provide, true);
                instance.next(Events.status, Status.provided);
                this.next(Status.provided, instance);
            })
        );
        store.logger.debug(`Provided instances for '${dir.path}'.`);
        this.debug(`Provided instances for '${dir.path}'.`);
        store.next(`${Events.provide}.${dir.statusName}`, true);
    }

    /**
     * Initialize an instance.
     */
    private async initializeInstances(
        instances: Set<any>,
        dir: DirectorySettings,
        store: Store = this.store
    ): Promise<void> {
        const initializeInstances = [...instances].filter(
            (instance) => instance.initializePriority
        );
        initializeInstances.sort(
            (a: any, b: any) => a.initializePriority - b.initializePriority
        );
        const initializeGroups = groupBy(
            initializeInstances,
            'initializePriority'
        );
        const initializePrios = Object.keys(
            initializeGroups
        ).map((prio: string) => parseInt(prio, 10));
        initializePrios.sort((a, b) => a - b);

        await Throttle.all(
            initializePrios.map((group) => async () =>
                await Throttle.all(
                    initializeGroups[group].map(
                        (instance: any) => async () => {
                            if (!Boot.checkEnabled(instance)) {
                                return;
                            }

                            if (!instance.initialize) {
                                return;
                            }

                            instance.next(Events.status, Status.initializing);
                            this.next(Status.initializing, instance);
                            const middlewares = this.getMiddlewaresOfInstance(
                              instance,
                              store,
                            );
                            await Throttle.all(
                                [...middlewares].map(
                                    (middleware: Middleware) => async () =>
                                        middleware.beforeInitialize(
                                            instance
                                        )
                                )
                            );
                            await instance.initialize();
                            await Throttle.all(
                                [...middlewares].map(
                                    (middleware: Middleware) => async () =>
                                        middleware.afterInitialize(instance)
                                )
                            );
                            instance.next(Events.init, true);
                            instance.next(Events.status, Status.initialized);
                            this.next(Status.initialized, instance);
                        }
                    )
                )
            ),
            {
                maxInProgress: 1,
            }
        );
        store.logger.debug(`Initialized instances for '${dir.path}'.`);
        this.debug(`Initialized instances for '${dir.path}'.`);
        store.next(`${Events.init}.${dir.statusName}`, true);
    }

    /**
     * Start an instance.
     */
    private async startInstances(
        instances: Set<any>,
        dir: DirectorySettings,
        store: Store = this.store
    ): Promise<void> {
        try {
            const startInstances = [...instances].filter(
                (instance) => instance.startPriority
            );
            startInstances.sort(
                (a: any, b: any) => a.startPriority - b.startPriority
            );
            const startGroups = groupBy(startInstances, 'startPriority');
            const startPrios = Object.keys(startGroups).map((prio: string) =>
                parseInt(prio, 10)
            );
            startPrios.sort((a, b) => a - b);

            await Throttle.all(
                startPrios.map((group) => async () =>
                    await Throttle.all(
                        startGroups[group].map((instance: any) => async () => {
                            if (!Boot.checkEnabled(instance)) {
                                return;
                            }

                            if (!instance.start) {
                                return;
                            }

                            instance.next(Events.status, Status.starting);
                            this.next(Status.starting, instance);
                            const middlewares = this.getMiddlewaresOfInstance(
                              instance,
                              store,
                            );
                            await Throttle.all(
                                [...middlewares].map((middleware: any) => async () =>
                                    middleware.beforeStart(instance)
                                )
                            );
                            await instance.start();
                            await Throttle.all(
                                [...middlewares].map((middleware: any) => async () =>
                                    middleware.afterStart(instance)
                                )
                            );
                            instance.next(Events.start, true);
                            instance.next(Events.status, Status.started);
                            this.next(Status.started, instance);
                        })
                    )
                ),
                {
                    maxInProgress: 1,
                }
            );
            store.logger.debug(`Started instances for '${dir.path}'.`);
            this.debug(`Started instances for '${dir.path}'.`);
            store.next(`${Events.start}.${dir.statusName}`, true);
        } catch (e) {
            await this.stopInstances(instances, dir, store);
            throw e;
        }
    }

    /**
     * Stop an instance.
     */
    private async stopInstances(
        instances: Set<any>,
        dir: DirectorySettings,
        store: Store = this.store
    ): Promise<void> {
        const stopInstances = [...instances].filter(
            (instance) => instance.stopPriority
        );
        stopInstances.sort(
            (a: any, b: any) => a.stopPriority - b.stopPriority
        );
        const stopGroups = groupBy(stopInstances, 'stopPriority');
        const stopPrios = Object.keys(stopGroups).map((prio: string) =>
            parseInt(prio, 10)
        );
        stopPrios.sort((a, b) => a - b);

        await Throttle.all(
            stopPrios.map((group) => async () =>
                await Throttle.all(
                    stopGroups[group].map((instance: any) => async () => {
                        if (!Boot.checkEnabled(instance)) {
                            return;
                        }

                        if (!instance.stop) {
                            return;
                        }

                        instance.next(Events.status, Status.stopping);
                        this.next(Status.stopping, instance);
                        const middlewares = this.getMiddlewaresOfInstance(
                          instance,
                          store,
                        );
                        await Throttle.all(
                            [...middlewares].map((middleware: any) => async () =>
                                middleware.beforeStop(instance)
                            )
                        );
                        await instance.stop();
                        await Throttle.all(
                            [...middlewares].map((middleware: any) => async () =>
                                middleware.afterStop(instance)
                            )
                        );
                        instance.next(Events.start, false);
                        instance.next(Events.status, Status.stopped);
                        this.next(Status.stopped, instance);
                    })
                )
            ),
            {
                maxInProgress: 1,
            }
        );
        store.logger.debug(`Stopped instances for '${dir.path}'.`);
        this.debug(`Stopped instances for '${dir.path}'.`);
        store.next(`${Events.start}.${dir.statusName}`, false);
    }

    /**
     * Stop the instance.
     */
    public async stop(
        store: Store = this.store,
        isReboot = false,
        stopDirectories?: Set<DirectorySettings>
    ): Promise<void> {
        try {
            this.next(Events.status, Status.stopping);

            // stop the watcher
            if (process.env.NODE_ENV !== 'production' && !isReboot) {
                store.unwatchFiles();
                store.next('start.watchers', false);
            }

            // get all directories
            const directories = stopDirectories
                ? [...stopDirectories]
                : Object.values(this.config.directories).filter(
                      (dir) => dir.start
                  );
            directories.sort(
                (a, b) => b.dependencies.size - a.dependencies.size
            );
            await Throttle.all(
                directories.map((dir) => async () => {
                    const instances = store.getInstancesOfType(dir.type as any);
                    await this.stopInstances(instances, dir, store);
                }),
                {
                    maxInProgress: 1,
                }
            );

            if (!isReboot) {
                store.unsubscribeAll('register');
            }

            await this.cleanUp(store, stopDirectories, isReboot);

            // init the start and general states
            const directoryNames = Object.keys(this.config.directories);
            directoryNames.forEach((dir) => {
                const name = this.config.directories[dir].statusName;
                store.next(`${Events.init}.${name}`, false);
                store.next(`${Events.load}.${name}`, false);
                store.next(`${Events.provide}.${name}`, false);
            });

            store.logger.info('Stopped service.');
            this.next(Events.status, Status.stopped);
        } catch (e) {
            store.logger.error(e.message);
            throw e;
        }
    }

    /**
     * Cleanup all stuff when shutting down.
     */
    private async cleanUp(
        store: Store = this.store,
        cleanUpDirectories?: Set<DirectorySettings>,
        isReboot = false,
    ): Promise<void> {
        const directories = cleanUpDirectories
            ? [...cleanUpDirectories]
            : Object.values(this.config.directories);

        store.stopAllScheduledTasks();
        store.clearScheduledTasks();

        // unload all instances by directory
        await Throttle.all(
            directories.map((dir) => async () => {
                const instances = store.getInstancesOfType(dir.type as any);
                await Throttle.all([...instances].map((instance) => async () => instance.close()));

                if (isReboot) {
                    store.removeInstances(instances);
                }
            }),
            {
                maxInProgress: 1,
            }
        );

        await Throttle.all(
          [...store.cache.simple._changedFiles]
            .map((file) => async () => {
                const instance = store.getInstanceFromFileMap(file);
                await this.removeFromFileCache(file, store);

                if (!instance) {
                    return;
                }

                await instance.destroy();
                store.deleteInstanceFromFileMap(file);
            })
        );
    }

    /**
     * Start things up with directories or by default all directories.
     */
    private async startup(
        isReboot = false,
        store: Store = this.store,
        startDirectories?: Set<DirectorySettings>
    ): Promise<void> {
        const directories = startDirectories
            ? [...startDirectories]
            : Object.values(this.config.directories);
        directories.sort(
            (a, b) => a.dependencies.size - b.dependencies.size
        );
        await Throttle.all(
            directories.map((dir) => async () =>
                this.loadInstancesOfDirectory(dir, store)
            )
        );
        await Throttle.all(
            directories.map((dir) => async () => {
                const instances = store.getInstancesOfType(dir.type as any);
                await this.initializeInstances(instances, dir, store);
            }),
            {
                maxInProgress: 1,
            }
        );
        await Throttle.all(
            directories.map((dir) => async () => {
                const instances = store.getInstancesOfType(dir.type as any);
                await this.startInstances(instances, dir, store);
                await this.runInstances(instances, dir, store);
            }),
            {
                maxInProgress: 1,
            }
        );
    }

    /**
     * Load all instances of a directory.
     */
    private async loadInstancesOfDirectory(
        dir: DirectorySettings,
        store: Store = this.store
    ): Promise<Set<BaseStructure>> {
        const instances = await this.loadSimple(dir, store, true);
        await this.provideInstances(instances, dir, store);
        return instances;
    }

    /**
     * Load all instances of a type.
     */
    private async loadInstancesOfType(
        type: BaseStructure,
        store: Store = this.store
    ): Promise<Set<BaseStructure>> {
        const dir = this.getDirectoryByType(type);

        if (!dir) {
            throw new Error(
                'Could not find directory config for this type.'
            );
        }

        const instances = await this.loadSimple(dir, store, true);
        await this.provideInstances(instances, dir, store);
        return instances;
    }

    /**
     * Restart the instance.
     */
    public async restart(store: Store = this.store): Promise<void> {
        this.next(Events.status, Status.restarting);
        this.debug(`Restarting boot...`);
        store.logger.info('Restarting...');

        // set the update time
        store.updateTime = Date.now();

        // restart the dependency tree
        const instanceTypes: Set<DirectorySettings> = new Set();
        const addChangedInstancesToTree = (
            instance: BaseStructure
        ) => {
            const baseDir = this.getDirectoryByType(instance);
            if (!baseDir) {
                throw new Error('Could not find directory for this type.');
            }

            // add the own directory of the changed file
            instanceTypes.add(baseDir);

            // get all types depending on the changed type
            const types = this.getDependents(instance);

            if (!types) {
                throw new Error('Could not find directory for this type.');
            }

            // iterate over each type and get the directory
            for (const type of types.keys()) {
                const dir = this.getDirectoryByType(type);

                if (!dir) {
                    throw new Error('No directory for this type found.');
                }

                instanceTypes.add(dir);
                this.debug(
                    `Found '${dir.path}' as dependency. Add for restarting.`
                );
            }
        };
        [...store.cache.simple._changedFiles].forEach((filePath) => {
            const instance = store.getInstanceFromFileMap(filePath);

            if (!instance) {
                store.logger.debug('Unknown instance. Skipping tree.');
                return;
            }

            addChangedInstancesToTree(instance);
        });
        await Throttle.all([...store.cache.simple._changedRegistered].map((update) => async () => {
            if (update.oldInstance) {
                const fetchedInstance = store.getInstance(update.oldInstance);

                if (!fetchedInstance) {
                    store.logger.debug('Unknown instance. Skipping tree.');
                    return;
                }

                await store.unregister(update.oldInstance);
            }

            if (update.newInstance) {
                addChangedInstancesToTree(update.newInstance);
            }
        }));

        // sort the structures with the most dependencies to the beginning and get it to restart all of them
        await this.stop(store, true, instanceTypes);
        await this.start(store, true, instanceTypes);
        this.debug(`Restarted boot.`);
        this.next(Events.status, Status.restarted);
    }

    /**
     * Get the directory by type.
     */
    private getDirectoryByType(
        type: BaseStructure
    ): DirectorySettings | undefined {
        return Object.values(this.config.directories).find(
            (dir) => dir.type === type || type instanceof (dir.type as any)
        );
    }

    /**
     * Get the dependencies of the giving type.
     */
    private getDependencies(
        type: BaseStructure
    ): Set<BaseStructure> | undefined {
        const dir = this.getDirectoryByType(type);
        return dir?.dependencies;
    }

    /**
     * Get the types which are dependent on the giving type.
     */
    private getDependents(
        type: BaseStructure
    ): Set<BaseStructure> {
        const dirs = Object.values(this.config.directories);
        const structures: Set<BaseStructure> = new Set();
        dirs.forEach((dir) => {
            if (
                dir.type !== type &&
                (~[...dir.dependencies].indexOf(type) ||
                    [...dir.dependencies].filter((dep) => type instanceof (dep as any))
                        .length)
            ) {
                structures.add(dir.type);
            }
        });

        return structures;
    }

    /*
     * Use this function to fetch middlewares of an instances with knowing the directory.
     */
    public getDirectoryMiddlewaresOfInstance(
        instance: BaseStructure,
        dir: DirectorySettings,
        store: Store = this.store
    ): Set<Middleware> {
        if (!(instance as any).middlewares || !(instance as any).middlewares.size) {
            return new Set();
        }

        return new Set(
            [...(instance as any).middlewares]
                .filter((x) => !!x)
                .map((mw) => {
                      if (typeof mw === typeof Middleware) {
                          const instance = store.getInstance(mw);

                          if (!instance) {
                              throw new Error('Instance of middleware not found!');
                          }

                          return instance;
                      }

                      return mw;
                })
                .filter((middleware: Middleware) => {
                    const middlewares = [...dir.middlewares]
                      .filter(
                        (mw) => (middleware as any) instanceof mw
                      );
                    return !!middlewares.length;
                })
        );
    }

    /*
     * Use this function to fetch middlewares of an instances without knowing the directory.
     */
    public getMiddlewaresOfInstance(
      instance: BaseStructure,
      store: Store = this.store
    ): Set<Middleware> {
        if (!(instance as any).middlewares || !(instance as any).middlewares.size) {
            return new Set();
        }

        const dir = Object.values(this.config.directories)
          .find((dir) => instance instanceof dir.type);

        if (!dir) {
            throw new Error('There is no root type for this instance.');
        }

        return this.getDirectoryMiddlewaresOfInstance(
          instance,
          dir,
          store,
        );
    }

    /*
     * Wrapper for resolving a path.
     */
    private resolvePath(path: string): string {
        return resolve(this.baseDir, path);
    }

    /*
     * This function is useful, when you want to async await a register of a new instance.
     */
    public async awaitRegister(store = this.store): Promise<void> {
        return new Promise((res, rej) => {
            setTimeout(() => rej('Timeout.'), 5000);

            const bootCycle = (status: Status) => {
                if (status === Status.started) {
                    this.removeListener(Events.status, bootCycle);
                    store.removeListener('register', registerCycle);
                    res();
                }
            };
            const registerCycle = () => {
                this.subscribe(Events.status, bootCycle);
            };

            store.subscribe('register', registerCycle);
        });
    };

    /*
     * Basic loading function of files.
     */
    private async loadSimple(
        dir: DirectorySettings,
        store: Store = this.store,
        cache = false
    ): Promise<Set<BaseStructure>> {
        const path = this.resolvePath(dir.path);
        const files = await this.getFiles(path, store);
        const instances = await this.loadFiles(files, store, cache);
        store.logger.debug(
            `Loaded ${files.length} file${
                files.length === 1 ? '' : 's'
            } from '${path}'.`
        );
        this.debug(`Loaded ${files.length} file${
            files.length === 1 ? '' : 's'
        } from '${path}'.`);
        store.next(`${Events.load}.${dir.statusName}`, true);
        return instances;
    }

    private async getFiles(
        path: string,
        store: Store = this.store
    ): Promise<string[]> {
        let files: string[] = [];
        const getFilesFromDir = async (
            pathName: string
        ): Promise<string[]> => {
            const dir = resolve(this.baseDir, pathName);
            await new Promise((res, rej) => {
                if (!existsSync(dir)) {
                    store.logger.debug(
                        `No directory named '${dir}' found. Skipping.`
                    );
                    res();
                }

                readdir(dir, async (err, fileNames) => {
                    if (err) rej(err);

                    await Throttle.all(
                        (fileNames || []).map((file) => async () => {
                            const subDir = resolve(
                                this.baseDir,
                                pathName,
                                file
                            );
                            if (lstatSync(subDir).isDirectory()) {
                                files = files.concat(
                                    await getFilesFromDir(subDir)
                                );
                            }
                        })
                    );
                    files = files.concat(fileNames);
                    res();
                });
            });
            return files
                .filter((file) => file.endsWith('.js'))
                .map((file) => resolve(dir, file));
        };

        return getFilesFromDir(path);
    }

    private async removeFromFileCache(
        fileName: string,
        store: Store = this.store
    ): Promise<void> {
        delete require.cache[require.resolve(fileName)];
        this.debug(`Removed '${fileName}' from file cache.`);
        store.logger.debug(`Removed '${fileName}' from file cache.`);
    }

    private async removeAllFromFileCache(
      store: Store = this.store
    ): Promise<void> {
        if (!Object.keys(store.cache.simple._fileMap).length) {
            return;
        }

        await Throttle.all(
          Object.keys(store.cache.simple._fileMap)
            .map((path) => async () => this.removeFromFileCache(
              path,
              store
            ))
        );
    }

    private async loadFile(
        fileName: string,
        store: Store = this.store,
        cache = false
    ): Promise<Set<BaseStructure>> {
        try {
            if (!cache) {
                await this.removeFromFileCache(fileName, store);
            }

            const formatItem = (item: any) => {
                if (!item.name) {
                    item.name = item.constructor.name;
                }
                return item;
            };

            // load the file
            if (store.getInstanceFromFileMap(fileName) && cache) {
                return new Set([store.registerInstanceFromPath(fileName)]);
            }

            // import the file
            return new Set(await Throttle.all(
                Object.keys(await import(fileName)).map((name) => async () => {
                    let item = (await import(fileName))[name];

                    // try to create a class instance or run a function
                    if (typeof item === 'function') {
                        item = new item();

                        if (!(item instanceof BaseStructure)) {
                            throw new Error('The generated instance is not an instance of BaseStructure.');
                        }
                    }

                    // add the object to the store
                    const instance = formatItem(item);
                    instance.next(Events.status, Status.configuring);
                    this.next(Status.configuring, instance);
                    await instance.configure();
                    instance.next(Events.configure, true);
                    instance.next(Events.status, Status.configured);
                    this.next(Status.configured, instance);
                    store.addInstanceToFileMap(fileName, instance);
                    store.registerInstanceFromPath(fileName);

                    return instance;
                })
            ));
        } catch (e) {
            store.logger.error(e.message);
            throw e;
        }
    }

    private async loadFiles(
        files: string[],
        store: Store = this.store,
        cache = false
    ): Promise<Set<BaseStructure>> {
        let instances: BaseStructure[] = [];

        await Throttle.all(
            files.map((fileName) => async () => {
                const instanceSet = await this.loadFile(fileName, store, cache);
                instances = instances.concat([...instanceSet]);
            })
        );

        // get each file and add it to the store
        return new Set(instances);
    }

    private watchFiles(store: Store = this.store): void {
        store.startFileWatcher();
        let delayTimer: NodeJS.Timer | undefined;
        const handler = async (path: string) => {
            store.cache.simple._changedFiles.add(path);

            // delay the reload for some milliseconds to prevent multiple quick reloads
            clearTimeout(delayTimer as NodeJS.Timer);
            delayTimer = setTimeout(async () => {
                this.debug(`Reloading dependencies.`);
                clearTimeout(delayTimer as NodeJS.Timer);
                store.watcher?.removeAllListeners();
                store.unwatchFiles();
                await this.restart(store);
                store.cache.simple._changedFiles.clear();
                store.watchFiles();
                attachWatcher();
                this.debug(`Finished reloading dependencies.`);
            }, this.config?.fileWatcherDelay || 100);
        };

        const attachWatcher = (): void => {
            store.watcher
                ?.on('add', async (path) => {
                    this.debug(`File '${path}' has been added.`);
                    store.logger.debug(`File ${path} has been added...`);
                    store.next('file.add', path);
                    return handler(path);
                })
                ?.on('change', async (path) => {
                    this.debug(`File '${path}' has changed.`);
                    store.logger.debug(`File ${path} has changed...`);
                    store.next('file.change', path);
                    return handler(path);
                })
                ?.on('unlink', async (path) => {
                    this.debug(`File '${path}' has been deleted.`);
                    store.logger.debug(`File ${path} has been deleted...`);
                    store.next('file.unlink', path);
                    return handler(path);
                });
        };

        attachWatcher();
    }

    private async runInstances(
        items: Set<any>,
        dir: DirectorySettings,
        store: Store = this.store
    ): Promise<void> {
        await Throttle.all(
            [...items].map((instance: any) => async () => {
                if (!Boot.checkEnabled(instance)) {
                    return;
                }

                if (
                    !instance.run ||
                    !dir.repeatable ||
                    !(instance instanceof Task)
                ) {
                    return;
                }

                const valid = validate(instance.schedule);

                if (!valid) {
                    throw new Error('Not a valid cron schedule!');
                }

                const foundTask = store.getScheduledTask(instance);

                if (foundTask) {
                    (foundTask as any)._count = 0;

                    if (instance.runInitially) {
                        await (foundTask as any).task(true);
                    }

                    foundTask.start();
                    return;
                }

                const taskRun = async (initial = false): Promise<void> => {
                    if (!initial) {
                        ++(task as any)._count;
                    }

                    const middlewares = this.getMiddlewaresOfInstance(
                      instance,
                      store,
                    );
                    await Throttle.all(
                        [...middlewares].map((middleware: any) => async () =>
                            middleware.beforeRun(instance)
                        ),
                        {
                            maxInProgress: 1,
                        }
                    );
                    await instance.run();
                    await Throttle.all(
                        [...middlewares].map((middleware: any) => async () =>
                            middleware.afterRun(instance)
                        ),
                        {
                            maxInProgress: 1,
                        }
                    );

                    if (
                        !!~instance.limit &&
                        (task as any)._count >= instance.limit
                    ) {
                        task.stop();
                        return;
                    }
                };
                const task = schedule(instance.schedule, taskRun, {
                    scheduled: true,
                    timezone: instance.timezone,
                });

                (task as any)._count = 0;
                (task as any)._instance = instance;

                if (instance.runInitially) {
                    await taskRun(true);
                }

                task.start();
                store.registerScheduledTask(task);
            })
        );
        store.logger.debug(`Run instances for '${dir.path}'.`);
        this.debug(`Run instances for '${dir.path}'.`);
    }
}

export default Boot;
