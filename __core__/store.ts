import Cache from './cache';
import StateSubscriber from 'state-subscriber';
import { Logger } from 'pino';
import { FSWatcher, watch } from 'chokidar';
import { name as packageName } from '../package.json';
import pino from 'pino';
import IORedis from 'ioredis';
import { Redis, RedisOptions } from 'ioredis';
import * as Throttle from 'promise-parallel-throttle';
import I18n from './i18n';
import { resolve, join } from 'path';
import { Status, BaseStructure, Constructor, Task, Config, Boot } from "./index";
import * as Types from './index';
import { filter } from 'lodash';
import { Debugger } from 'debug';
import { ScheduledTask } from 'node-cron';
import { createWriteStream, WriteStream } from 'fs';
import { PassThrough } from 'stream';
import { boot } from '../bin';

export default class Store extends StateSubscriber {
    private readonly loggingStream?: WriteStream;
    public readonly debug: Debugger;
    private readonly registeredInstances: Set<
        InstanceType<Constructor>
    > = new Set([]);
    private readonly instances: Set<InstanceType<Constructor>> = new Set([]);
    private readonly tasks: Set<ScheduledTask> = new Set([]);
    private readonly baseDir: string;
    public readonly i18n: I18n;
    public readonly cache: Cache;
    public logger: Logger;
    public connections: {
        redis: {
            [name: string]: Redis;
        };
    };
    public startTime = 0;
    public bootTime = 0;
    public readonly initTime: number = Date.now();
    public updateTime: number = Date.now();
    public watcher?: FSWatcher;
    private readonly bootDirectories: Config['directories'];

    constructor(config: {
        prefix: string;
        instanceName: string;
        baseDir: string;
        config: Config;
        logLevel?: string;
        language?: string;
    }) {
        super();
        this.debug = boot.generateDebugger('store');
        this.bootDirectories = config.config.directories;

        if (!config.logLevel) {
            config.logLevel = 'info';
        }

        this.i18n = new I18n(config.language);
        this.baseDir = config.baseDir;
        this.connections = {
            redis: {},
        };
        const redisOptions: RedisOptions = {
            host: process.env.REDIS_HOST || '0.0.0.0',
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD,
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            db: parseInt(process.env.REDIS_DB || '0', 10),
            family: parseInt(process.env.REDIS_FAMILY || '4', 10),
            lazyConnect: true,
            retryStrategy(times: number): number | void | null {
                return Math.min(times * 200, 2000);
            }
        };
        this.connections.redis = {
            cache: new IORedis(redisOptions),
        };
        this.cache = {
            simple: {
                _fileMap: {},
                _changedFiles: new Set(),
                _changedRegistered: new Set(),
            },
            redis: this.connections.redis.cache,
        };

        const logPhysical = Boot.getEnvVar('LOG_PHYSICAL', true);
        if (logPhysical) {
            const logThrough = new PassThrough();

            this.logger = pino({
                name: packageName,
                level: process.env.LOG_LEVEL || config.logLevel,
                timestamp: pino.stdTimeFunctions.epochTime,
            }, logThrough);

            this.loggingStream = createWriteStream(resolve(config.config.logDirectory, `${Date.now().toString()}.log`));
            logThrough.pipe(this.loggingStream);
            logThrough.pipe(process.stdout);
        } else {
            this.logger = pino({
                name: packageName,
                level: process.env.LOG_LEVEL || config.logLevel,
                timestamp: pino.stdTimeFunctions.epochTime,
                prettyPrint: process.env.NODE_ENV !== 'production' && !Boot.getEnvVar('LOG_DISABLE_PRETTY_PRINT', true),
            });
        }
    }

    /**
     * Returns the uptime in ms.
     */
    public getUptime(): number {
        return Date.now() - this.initTime;
    }

    /**
     * Returns the start up time in ms.
     */
    public getStartUpTime(): number {
        return this.bootTime - this.startTime;
    }

    /**
     * Returns the start up time in ms.
     */
    public getBootTime(): number {
        return this.bootTime - this.updateTime;
    }

    /**
     * Init the store.
     */
    public async init(): Promise<void> {
        this.next('status', Status.initializing);

        // connect all redis instances
        await Throttle.all(Object.keys(this.connections.redis)
            .map((name) => async () => this.connections.redis[name].connect()));

        this.logger.debug('Done initializing store.');
        this.next('status', Status.initialized);
    }

    /**
     * Close the store gracefully.
     */
    public async close(): Promise<void> {
        await Throttle.all(
            Object.values(
                this.connections.redis
            ).map((connection) => async () => await connection.disconnect())
        );
        await this.stopFileWatcher();
        await this.logger.removeAllListeners();
        this.loggingStream?.close();
    }

    /**
     * Stop watching all necessary files.
     */
    public unwatchFiles(): void {
        this.watcher?.unwatch(
            Object.values(this.bootDirectories).map((directory) =>
                join(`${resolve(this.baseDir, directory.path)}`, '/**', '/*.js')
            )
        );
        this.logger.debug('Stopped watching files.');
    }

    /**
     * Start watching all necessary files.
     */
    public watchFiles(): void {
        this.watcher?.add(
            Object.values(this.bootDirectories).map((directory) =>
                join(`${resolve(this.baseDir, directory.path)}`, '/**', '/*.js')
            )
        );
        this.logger.debug('Started watching files.');
    }

    /**
     * Start watching all necessary files.
     */
    public startFileWatcher(): void {
        this.watcher = watch(
            Object.values(this.bootDirectories).map((directory) =>
                join(`${resolve(this.baseDir, directory.path)}`, '/**', '/*.js')
            ),
            {
                ignoreInitial: true,
                ignored: /(^|[/\\])\../,
                persistent: true,
                followSymlinks: true,
            }
        );
        this.logger.debug('Started watching files.');
    }

    /**
     * Start watching all necessary files.
     */
    public async stopFileWatcher(): Promise<void> {
        this.watcher?.removeAllListeners();
        await (this.watcher as any)?.close();
        this.logger.debug('Stopped watching files.');
    }

    /**
     * Update all instances of a directory.
     */
    public linkInstances<Constr extends Constructor>(
        name: string,
        instances: Set<InstanceType<Constr>> | BaseStructure[]
    ): void {
        [...instances].forEach((instance: any) => {
            (this as any)[name][
                `v${instance.version}.${instance.name}`
            ] = instance;
        });
    }

    /**
     * Add an instance to the list.
     */
    public addInstance<Constr extends Constructor>(
        item: InstanceType<Constr>
    ): void {
        this.instances.add(item);
    }

    /**
     * Add bulk of instances to the list.
     */
    public addInstanceBulk<Constr extends Constructor>(
        items: Set<InstanceType<Constr>>
    ): void {
        [...items].forEach((item) => this.instances.add(item));
    }

    /**
     * Remove an instance from the list.
     */
    public removeInstance<Constr extends Constructor>(
        item: InstanceType<Constr>
    ): void {
        this.instances.delete(item);
    }

    /**
     * Remove all instances given from the list.
     */
    public removeInstances<Constr extends Constructor>(
        items: Set<InstanceType<Constr>>
    ): void {
        items.forEach((item) => this.instances.delete(item));
    }

    /**
     * Remove all instances from the list.
     */
    public clearInstances(): void {
        this.instances.clear();
    }

    /**
     * Add a external registered instance to the store.
     * Set createInstance to true, if you are giving in a class and want to generate automatically an instance for this class.
     */
    public async register<Constr extends Constructor>(
        instance: InstanceType<Constr>,
        createInstance = false
    ): Promise<InstanceType<Constr>> {
        const createdInstance = await this.createAndAddInstance(
            instance,
            createInstance
        );
        this.next('register', createdInstance);
        return createdInstance;
    }

    /**
     * Create and add an instance and run the configure function.
     */
    private async createAndAddInstance<Constr extends Constructor>(
        instance: InstanceType<Constr>,
        createInstance = false
    ): Promise<InstanceType<Constr>> {
        if (createInstance) {
            instance = new instance();
        }

        if (!instance.name) {
            (instance as any).name = instance.constructor.name;
        }

        if (this.registeredInstances.has(instance)) {
            throw new Error('Already registered.');
        }

        await instance.configure();
        this.registeredInstances.add(instance);
        this.linkRegistered(instance);
        this.cache.simple._changedRegistered.add(instance);
        this.logger.debug(`Registered instance '${instance.name}'.`);
        this.debug(`Registered instance '${instance.name}'.`);
        return instance;
    }

    /**
     * Add a external registered instance to the store as an bulk.
     * This will prevent the instance to reboot each time, but will reboot once after the bulk is added.
     */
    public async registerBulk<Constr extends Constructor>(
        instances: Set<{
            instance: InstanceType<Constr>;
            createInstance?: boolean;
        }>
    ): Promise<Set<InstanceType<Constr>>> {
        const outputInstances: Set<InstanceType<Constr>> = new Set();
        for (const entry of instances) {
            if (!Object.prototype.hasOwnProperty.call(entry, 'createInstance')) {
                entry.createInstance = false;
            }

            const createdInstance = await this.createAndAddInstance(
                entry.instance,
                entry.createInstance
            );
            outputInstances.add(createdInstance);
        }

        this.next('register', outputInstances);
        this.debug(`Registered bulk of instances.`);
        return outputInstances;
    }

    /**
     * Remove an registered instance if available.
     */
    public unregister<Constr extends Constructor>(
        instance: InstanceType<Constr>
    ): void {
        this.registeredInstances.delete(instance);
        this.debug(`Unregistered instance '${instance.name}'.`);
        this.next('register', instance);
    }

    /**
     * Update a registered instance if available.
     */
    public async registerUpdate<Constr extends Constructor>(
        oldInstance: InstanceType<Constr>,
        newInstance: InstanceType<Constr>,
        createInstance = false
    ): Promise<InstanceType<Constr>> {
        this.registeredInstances.delete(oldInstance);
        return this.register(newInstance, createInstance);
    }

    /**
     * Update a multiple registered instances if available.
     */
    public async registerUpdateBulk<Constr extends Constructor>(
        instances: Set<{
            oldInstance: InstanceType<Constr>;
            newInstance: InstanceType<Constr>;
            createInstance: boolean;
        }>
    ): Promise<Set<InstanceType<Constr>>> {
        const outputInstances: Set<InstanceType<Constr>> = new Set();

        for (const entry of instances) {
            this.registeredInstances.delete(entry.oldInstance);
            if (!Object.prototype.hasOwnProperty.call(entry, 'createInstance')) {
                entry.createInstance = false;
            }

            const createdInstance = await this.createAndAddInstance(
                entry.newInstance,
                entry.createInstance
            );
            outputInstances.add(createdInstance);
        }

        this.next('register', outputInstances);
        return outputInstances;
    }

    /**
     * Link the registered instances to the instances.
     */
    public linkRegistered<Constr extends Constructor>(
        instance?: InstanceType<Constr>
    ): void {
        if (instance) {
            if (!this.registeredInstances.has(instance)) {
                return;
            }

            for (const inst of this.registeredInstances.keys()) {
                if (inst === instance) {
                    this.instances.add(inst);
                    return;
                }
            }

            this.logger.debug(`Linked instance ${instance.name}.`);
            this.debug(`Linked instance ${instance.name}.`);
            return;
        }

        for (const inst of this.registeredInstances.keys()) {
            this.instances.add(inst);
        }
        this.logger.debug('Linked instances.');
        this.debug('Linked instances.');
    }

    /**
     * Get the instance with name and type.
     * Will return the same type given in type or undefined if not found.
     * If no version, it will get the latest else it will return a fixed version.
     */
    public getInstance<Constr extends Constructor>(
        type: Constr,
        nameOrVersion?: string | number,
        versionOrName?: number | string
    ): InstanceType<Constr> | undefined {
        let version = -1;
        let name = '';
        let items = [...this.getInstancesOfType(type)];

        if (typeof nameOrVersion === 'string') {
            name = nameOrVersion as string;
        } else if (typeof nameOrVersion === 'number') {
            version = nameOrVersion as number;
        }

        if (typeof versionOrName === 'string') {
            name = versionOrName as string;
        } else if (typeof versionOrName === 'number') {
            version = versionOrName as number;
        }

        if (name) {
            items = filter(items, (item) => item.name === name);
        }

        if (!items.length) {
            return;
        }

        items.sort((a, b) => b.version - a.version);
        let [instance] = items;

        if (version === -1) {
            this.debug(`Found instance '${instance.name}'.`);
            return instance as InstanceType<Constr>;
        }

        instance = items.find((item) => item.version === version) as any;
        this.debug(`Found instance '${instance.name}'.`);
        return instance;
    }

    /**
     * Get the instance by name and optional version.
     * Not recommended, use getInstance instead for better performance, but sometimes this is necessary.
     */
    public getInstanceByName(
        name: string,
        version = -1
    ): BaseStructure | undefined {
        const items = filter([...this.instances], (item) => item.name === name) as BaseStructure[];

        if (!items.length) {
            this.debug(`Could not find instance.`);
            return;
        }

        items.sort((a, b) => b.version - a.version);
        let instance: BaseStructure | undefined;
        [instance] = items;

        if (!instance) {
            this.debug(`Could not find instance.`);
            return;
        }

        if (version === -1) {
            this.debug(`Found instance '${instance.name}'.`);
            return instance;
        }

        instance = items.find((item) => item.version === version);

        if (!instance) {
            this.debug(`Could not find instance.`);
            return;
        }

        this.debug(`Found instance '${instance.name}'.`);
        return instance as BaseStructure;
    }

    /**
     * Get all instances with type.
     */
    public getInstancesOfType<Constr extends Constructor>(
        type: Constr
    ): Set<InstanceType<Constr>> {
        return new Set(
            filter([...this.instances], (item) => item instanceof type)
        );
    }

    /**
     * Get all instances.
     */
    public getAllInstances<Constr extends Constructor>(): Set<
        InstanceType<Constr>
    > {
        return new Set([...this.instances]);
    }

    /**
     * Get all registered instances.
     */
    public getAllRegisteredInstances<Constr extends Constructor>(): Set<
        InstanceType<Constr>
    > {
        return new Set([...this.registeredInstances]);
    }

    /**
     * Get all physical instances.
     */
    public getAllPhysicalInstances<Constr extends Constructor>(): Set<
        InstanceType<Constr>
    > {
        return new Set(Object.values(this.cache.simple._fileMap));
    }

    /**
     * Register a physical file in the _fileMap, based on the registered instances.
     */
    public registerInstanceFromPath<Constr extends Constructor>(
        path: string
    ): BaseStructure {
        if (!this.cache.simple._fileMap[path]) {
            throw new Error(
                'Could not find instance. Have you added it first?'
            );
        }

        this.addInstance(this.cache.simple._fileMap[path]);
        this.logger.debug(`Registered instance from path '${path}'.`);
        this.debug(`Registered instance from path '${path}'.`);
        return this.cache.simple._fileMap[path];
    }

    /**
     * Get a class by giving in the same name as the class has.
     */
    public getClassByName(name: string): BaseStructure {
        return (Types as any)[name];
    }

    /**
     * Add an instance to the file map.
     */
    addInstanceToFileMap(path: string, instance: BaseStructure): void {
        this.cache.simple._fileMap[path] = instance;
    }

    /**
     * Delete an instance from the file map.
     */
    deleteInstanceFromFileMap(path: string): void {
        delete this.cache.simple._fileMap[path];
    }

    /**
     * Delete an instance from the registered map.
     */
    deleteInstanceFromRegisterMap(instance: BaseStructure): void {
        this.cache.simple._changedRegistered.delete(instance);
    }

    /**
     * Get an instance from a file map.
     */
    getInstanceFromFileMap(path: string): BaseStructure | undefined {
        return this.cache.simple._fileMap[path];
    }

    /**
     * Register a new scheduled task.
     */
    registerScheduledTask(task: ScheduledTask): void {
        this.tasks.add(task);
    }

    /**
     * Get a scheduled task based on an instance.
     */
    getScheduledTask(instance: Task): ScheduledTask | undefined {
        if (!(instance instanceof Task)) {
            return;
        }

        const items = [...this.tasks];
        return items.find((item) => (item as any)._instance === instance);
    }

    /**
     * Stop a scheduled task based on an instance.
     */
    stopScheduledTask(instance: Task): ScheduledTask | undefined {
        const task = this.getScheduledTask(instance);

        if (!task) {
            this.debug(`Couldn't find a task for '${instance.name}'.`);
            return;
        }

        task.stop();
        this.debug(`Stopped task '${(task as any)._instance.name}'.`);
        return task;
    }

    /**
     * Stop all scheduled tasks.
     */
    stopAllScheduledTasks(): void {
        [...this.tasks].forEach((task) => task.stop());
        this.debug(`Stopped all tasks.`);
    }

    /**
     * Delete a scheduled task based on an instance.
     */
    deleteScheduledTask(instance: Task): void {
        const task = this.stopScheduledTask(instance);

        if (!task) {
            this.debug(`Couldn't find a task for '${instance.name}'.`);
            return;
        }

        task.destroy();
        this.tasks.delete(task);
        this.debug(`Deleted task '${(task as any)._instance.name}'.`);
    }

    /**
     * Clear the scheduled task registry.
     */
    clearScheduledTasks(): void {
        [...this.tasks].forEach((task) =>
            this.deleteScheduledTask((task as any)._instance)
        );
        this.debug(`Cleared all tasks.`);
    }
}
