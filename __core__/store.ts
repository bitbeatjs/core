import BaseStructure from './baseStructure';
import Events from './events';
import I18n from './i18n';
import StateSubscriber from 'state-subscriber';
import Status from './status';
import Task from './task';
import pino, { Logger } from 'pino';
import { Cache, Config, Constructor } from './interfaces';
import { debug, Debugger } from 'debug';
import { FSWatcher, watch } from 'chokidar';
import { PassThrough } from 'stream';
import { ScheduledTask } from 'node-cron';
import { createWriteStream, WriteStream } from 'fs';
import { filter } from 'lodash';
import { getEnvVar } from './functions';
import { join, resolve } from 'path';
import { name as packageName } from '../package.json';
import { compare } from 'semver';
export default class Store extends StateSubscriber {
    private readonly name: string;
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
    public startTime = 0;
    public bootTime = 0;
    public readonly initTime: number = Date.now();
    public updateTime: number = Date.now();
    public watcher?: FSWatcher;
    private readonly bootDirectories: Config['directories'];

    constructor(config: {
        directories: Config['directories'];
        logDirectory: Config['logDirectory'];
        baseDir: string;
        instanceName: string;
        logLevel?: string;
        language?: string;
    }) {
        super();
        this.name = config.instanceName;
        this.debug = this.generateDebugger('store', this.name);
        this.bootDirectories = config.directories;

        if (!config.logLevel) {
            config.logLevel = 'info';
        }

        this.i18n = new I18n(config.language);
        this.baseDir = config.baseDir;
        this.cache = {
            simple: {
                _fileMap: {},
                _changedFiles: new Set(),
                _changedRegistered: new Set(),
            },
        };

        const logPhysical = getEnvVar('LOG_PHYSICAL', true) as boolean;
        if (logPhysical) {
            const logThrough = new PassThrough();

            this.logger = pino(
                {
                    name: packageName,
                    level: process.env.LOG_LEVEL || config.logLevel,
                    timestamp: pino.stdTimeFunctions.epochTime,
                },
                logThrough
            );

            this.loggingStream = createWriteStream(
                resolve(config.logDirectory, `${Date.now().toString()}.log`)
            );
            logThrough.pipe(this.loggingStream);
            logThrough.pipe(process.stdout);
        } else {
            this.logger = pino({
                name: packageName,
                level: process.env.LOG_LEVEL || config.logLevel,
                timestamp: pino.stdTimeFunctions.epochTime,
                prettyPrint:
                    process.env.NODE_ENV !== 'production' &&
                    (!getEnvVar('LOG_DISABLE_PRETTY_PRINT', true) as boolean),
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
        this.next(Events.status, Status.initializing);
        this.debugLog('Done initializing store.', this.debug);
        this.next(Events.status, Status.initialized);
    }

    /**
     * Close the store gracefully.
     */
    public async close(): Promise<void> {
        await this.stopFileWatcher();
        this.registeredInstances.clear();
        this.instances.clear();
        this.tasks.clear();
        this.logger.removeAllListeners();
        this.loggingStream?.close();
    }

    /**
     * Remove the necessary files from the watcher.
     */
    public unwatchFiles(): void {
        this.watcher?.unwatch(
            Object.values(this.bootDirectories).map((directory) =>
                join(`${resolve(this.baseDir, directory.path)}`, '/**', '/*.js')
            )
        );
        this.debugLog('Stopped watching files.', this.debug);
    }

    /**
     * Add the necessary files to the watcher.
     */
    public watchFiles(): void {
        this.watcher?.add(
            Object.values(this.bootDirectories).map((directory) =>
                join(`${resolve(this.baseDir, directory.path)}`, '/**', '/*.js')
            )
        );
        this.debugLog('Started watching files.', this.debug);
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
        this.debugLog('Started watching files.', this.debug);
    }

    /**
     * Stop watching all necessary files.
     */
    public async stopFileWatcher(): Promise<void> {
        this.watcher?.removeAllListeners();
        await (this.watcher as any)?.close();
        this.debugLog('Stopped watching files.', this.debug);
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
     * If you are giving in a class it will automatically create an instance of it.
     */
    public async register<Constr extends Constructor>(
        instance: InstanceType<Constr>,
        reboot = true
    ): Promise<InstanceType<Constr>> {
        const createdInstance = await this.createAndAddInstance(instance);
        this.next(Events.register, {
            instances: new Set([createdInstance]),
            reboot,
        });
        return createdInstance;
    }

    /**
     * Create and add an instance and run the configure function.
     */
    private async createAndAddInstance<Constr extends Constructor>(
        instance: InstanceType<Constr>
    ): Promise<InstanceType<Constr>> {
        if (typeof instance === 'function') {
            instance = new instance();
        }

        if (!instance) {
            throw new Error('Unknown instance.');
        }

        if (!instance.name) {
            (instance as any).name = instance.constructor.name;
        }

        const proxyInstance = this.applyProxyToInstance(
            instance
        ) as InstanceType<Constr>;
        if (this.registeredInstances.has(proxyInstance)) {
            throw new Error('Already registered.');
        }

        proxyInstance.next(Events.status, Status.configuring);
        this.next(Status.configuring, proxyInstance);
        await proxyInstance.configure();
        proxyInstance.next(Events.configure, true);
        proxyInstance.next(Events.status, Status.configured);
        this.next(Status.configured, proxyInstance);
        this.registeredInstances.add(proxyInstance);
        this.linkRegistered(proxyInstance);
        this.cache.simple._changedRegistered.add({
            newInstance: proxyInstance,
            oldInstance: undefined,
        });
        this.debugLog(
            `Registered instance '${proxyInstance.name}'.`,
            this.debug
        );
        return proxyInstance;
    }

    /**
     * Add a external registered instance to the store as an bulk.
     * This will prevent the instance to reboot each time, but will reboot once after the bulk is added.
     */
    public async registerBulk<Constr extends Constructor>(
        instances: Set<InstanceType<Constr>>,
        reboot = true
    ): Promise<Set<InstanceType<Constr>>> {
        const outputInstances: Set<InstanceType<Constr>> = new Set();
        for (const entry of instances) {
            const createdInstance = await this.createAndAddInstance(entry);
            outputInstances.add(createdInstance);
            this.debugLog(
                `Registered instance '${createdInstance.name}'.`,
                this.debug
            );
        }

        this.next(Events.register, {
            instances: outputInstances,
            reboot,
        });
        this.debugLog(`Registered bulk of instances.`, this.debug);
        return outputInstances;
    }

    /**
     * Remove an registered instance if available.
     */
    public async unregister<Constr extends Constructor>(
        instance: InstanceType<Constr>,
        reboot = true
    ): Promise<void> {
        if (!this.registeredInstances.has(instance)) {
            throw new Error('Not registered.');
        }

        await instance.destroy();
        this.instances.delete(instance);
        this.registeredInstances.delete(instance);

        this.cache.simple._changedRegistered.add({
            newInstance: undefined,
            oldInstance: instance,
        });
        this.debugLog(`Unregistered instance '${instance.name}'.`, this.debug);
        this.next(Events.register, {
            instances: new Set([instance]),
            reboot,
        });
    }

    /**
     * Remove external registered instance from the store as an bulk.
     * This will prevent the instance to reboot each time, but will reboot once after the bulk is removed.
     */
    public async unregisterBulk<Constr extends Constructor>(
        instances: Set<InstanceType<Constr>>,
        reboot = true
    ): Promise<Set<InstanceType<Constr>>> {
        for (const entry of instances) {
            if (!this.registeredInstances.has(entry)) {
                throw new Error('Not registered.');
            }

            await entry.destroy();
            this.instances.delete(entry);
            this.registeredInstances.delete(entry);

            this.cache.simple._changedRegistered.add({
                newInstance: undefined,
                oldInstance: entry,
            });
            this.debugLog(`Unregistered instance '${entry.name}'.`, this.debug);
        }

        this.next(Events.register, {
            instances,
            reboot,
        });
        this.debugLog(`Unregistered bulk of instances.`, this.debug);
        return instances;
    }

    /**
     * Update a registered instance if available.
     */
    public async registerUpdate<Constr extends Constructor>(
        oldInstance: InstanceType<Constr>,
        newInstance: InstanceType<Constr>
    ): Promise<InstanceType<Constr>> {
        if (!this.registeredInstances.has(oldInstance)) {
            throw new Error('Not registered.');
        }

        await oldInstance.destroy();
        this.instances.delete(oldInstance);
        this.registeredInstances.delete(oldInstance);
        await this.register(newInstance);
        this.debugLog(`Updated instance '${oldInstance.name}'.`, this.debug);
        return newInstance;
    }

    /**
     * Update a multiple registered instances if available.
     */
    public async registerUpdateBulk<Constr extends Constructor>(
        instances: Set<{
            oldInstance: InstanceType<Constr>;
            newInstance: InstanceType<Constr>;
        }>,
        reboot = true
    ): Promise<Set<InstanceType<Constr>>> {
        const outputInstances: Set<InstanceType<Constr>> = new Set();

        for (const entry of instances) {
            this.registeredInstances.delete(entry.oldInstance);
            const createdInstance = await this.createAndAddInstance(
                entry.newInstance
            );
            outputInstances.add(createdInstance);
        }

        this.next(Events.register, {
            instances: outputInstances,
            reboot,
        });
        return outputInstances;
    }

    /**
     * Link the registered instances to the instances.
     */
    public linkRegistered<Constr extends Constructor>(
        instance?: InstanceType<Constr>
    ): void {
        if (instance) {
            if (!this.checkRegisteredInstance(instance)) {
                this.debugLog(
                    `Instance '${instance.name}' was not found in registered.`,
                    this.debug
                );
                return;
            }

            for (const inst of this.registeredInstances.keys()) {
                if (inst === instance) {
                    this.instances.add(inst);
                    return;
                }
            }

            this.debugLog(`Linked instance '${instance.name}'.`, this.debug);
            return;
        }

        for (const inst of this.registeredInstances.keys()) {
            this.instances.add(inst);
        }
        this.debugLog(
            `Linked ${this.registeredInstances.size} instances.`,
            this.debug
        );
    }

    /**
     * Get the instance with name and type.
     * Will return the same type given in type or undefined if not found.
     * If no version, it will get the latest else it will return a fixed version.
     */
    public getInstance<Constr extends Constructor>(
        type: Constr,
        name?: string,
        version?: string | number
    ): InstanceType<Constr> | undefined {
        if (!type) {
            throw new Error(`Can't fetch an instance of undefined.`);
        }

        let items = [...this.getInstancesOfType(type)];
        if (name) {
            items = filter(items, (item) => item.name === name);
        }

        if (!items.length) {
            return;
        }

        items.sort((a, b) =>
            compare(b.version.toString(), a.version.toString())
        );
        let [instance] = items;

        if (!version) {
            this.debugLog(`Found instance '${instance.name}'.`, this.debug);
            return instance as InstanceType<Constr>;
        }

        instance = items.find((item) => item.version === version) as any;
        this.debugLog(`Found instance '${instance.name}'.`, this.debug);
        return instance;
    }

    /**
     * Get the instance by name and optional version.
     * Not recommended, use getInstance instead for better performance, but sometimes this is necessary.
     */
    public getInstanceByName(
        name: string,
        version?: string | number
    ): BaseStructure | undefined {
        const items = filter(
            [...this.instances],
            (item) => item.name === name
        ) as BaseStructure[];

        if (!items.length) {
            this.debugLog(`Could not find instance.`, this.debug);
            return;
        }

        items.sort((a, b) =>
            compare(b.version.toString(), a.version.toString())
        );
        let instance: BaseStructure | undefined;
        [instance] = items;

        if (!instance) {
            this.debugLog(`Could not find instance.`, this.debug);
            return;
        }

        if (!version) {
            this.debugLog(`Found instance '${instance.name}'.`, this.debug);
            return instance;
        }

        instance = items.find((item) => item.version === version);

        if (!instance) {
            this.debugLog(`Could not find instance.`, this.debug);
            return;
        }

        this.debugLog(`Found instance '${instance.name}'.`, this.debug);
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
     * Get path of an physical instance.
     */
    public getPathOfPhysicalInstance(instance: BaseStructure): string {
        const [path] = Object.keys(this.cache.simple._fileMap).filter(
            (path) => {
                if (this.cache.simple._fileMap[path] === instance) {
                    return path;
                }
            }
        );
        return path;
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
        this.debugLog(`Registered instance from path '${path}'.`, this.debug);
        return this.cache.simple._fileMap[path];
    }

    /**
     * Add an instance to the file map.
     */
    public addInstanceToFileMap(path: string, instance: BaseStructure): void {
        this.cache.simple._fileMap[path] = instance;
    }

    /**
     * Delete an instance from the file map.
     */
    public deleteInstanceFromFileMap(path: string): void {
        delete this.cache.simple._fileMap[path];
    }

    /**
     * Delete an instance from the registered map.
     */
    public deleteInstanceFromRegisterMap(update: {
        oldInstance: InstanceType<Constructor>;
        newInstance: InstanceType<Constructor>;
    }): void {
        this.cache.simple._changedRegistered.delete(update);
    }

    /**
     * Get an instance from a file map.
     */
    public getInstanceFromFileMap(path: string): BaseStructure | undefined {
        return this.cache.simple._fileMap[path];
    }

    /**
     * Check an instance if it is registered already.
     */
    public checkRegisteredInstance(instance: BaseStructure): boolean {
        return this.registeredInstances.has(instance);
    }

    /**
     * Register a new scheduled task.
     */
    public registerScheduledTask(task: ScheduledTask): void {
        this.tasks.add(task);
    }

    /**
     * Get a scheduled task based on an instance.
     */
    public getScheduledTask(instance: Task | any): ScheduledTask | undefined {
        if (!(instance instanceof Task)) {
            return;
        }

        const items = [...this.tasks];
        return items.find((item) => (item as any)._instance === instance);
    }

    /**
     * Start a scheduled task based on an instance.
     */
    public startScheduledTask(instance: Task): ScheduledTask | undefined {
        const task = this.getScheduledTask(instance);

        if (!task) {
            this.debugLog(
                `Couldn't find a task for '${instance.name}'.`,
                this.debug
            );
            return;
        }

        task.start();
        this.debugLog(
            `Started task '${(task as any)._instance.name}'.`,
            this.debug
        );
        return task;
    }

    /**
     * Start all scheduled tasks.
     */
    public startAllScheduledTasks(): void {
        [...this.tasks].forEach((task) => {
            this.startScheduledTask((task as any)._instance as Task);
        });
        this.debugLog(`Started all tasks.`, this.debug);
    }

    /**
     * Stop a scheduled task based on an instance.
     */
    public stopScheduledTask(instance: Task): ScheduledTask | undefined {
        const task = this.getScheduledTask(instance);

        if (!task) {
            this.debugLog(
                `Couldn't find a task for '${instance.name}'.`,
                this.debug
            );
            return;
        }

        task.stop();
        this.debugLog(
            `Stopped task '${(task as any)._instance.name}'.`,
            this.debug
        );
        return task;
    }

    /**
     * Stop all scheduled tasks.
     */
    public stopAllScheduledTasks(): void {
        [...this.tasks].forEach((task) =>
            this.stopScheduledTask((task as any)._instance as Task)
        );
        this.debugLog(`Stopped all tasks.`, this.debug);
    }

    /**
     * Delete a scheduled task based on an instance.
     */
    public deleteScheduledTask(instance: Task): void {
        const task = this.stopScheduledTask(instance);

        if (!task) {
            this.debugLog(
                `Couldn't find a task for '${instance.name}'.`,
                this.debug
            );
            return;
        }

        task.destroy();
        this.tasks.delete(task);
        this.debugLog(
            `Deleted task '${(task as any)._instance.name}'.`,
            this.debug
        );
    }

    /**
     * Clear the scheduled task registry.
     */
    public clearScheduledTasks(): void {
        [...this.tasks].forEach((task) =>
            this.deleteScheduledTask((task as any)._instance as Task)
        );
        this.debugLog(`Cleared all tasks.`, this.debug);
    }

    /**
     * Generate a proxy for an instance to use this instead of the direct instance.
     */
    public applyProxyToInstance(instance: BaseStructure): BaseStructure {
        const proxyInstance = new Proxy(instance, {
            set: (target: any, prop: string, value: any, receiver: any) => {
                // skip the event from being emitted to prevent infinite loop
                if (prop === 'event') {
                    return Reflect.set(target, prop, value, receiver);
                }
                // emit the changed value
                instance.next(Events.change, {
                    prop,
                    value,
                    oldValue: target[prop],
                });
                // run the change
                return Reflect.set(target, prop, value, receiver);
            },
        });
        this.debugLog(
            `Created proxy instance for '${instance.name}'.`,
            this.debug
        );
        return proxyInstance;
    }

    /**
     * Log a message in the debug log and in the debugger.
     */
    public debugLog = (
        message: string,
        debugFunction: (message: string) => void
    ): void => {
        debugFunction(message);
        this.logger.debug(message);
    };

    /**
     * This will generate you an instance of a debugger in the namespace of the core.
     */
    public generateDebugger(name: string, scope = this.name): Debugger {
        const scopedDebugger = debug(`${scope}:${name}`);

        if (getEnvVar('BITBEAT_DEBUG', true) as boolean) {
            debug.enable(
                (getEnvVar('BITBEAT_DEBUG_NAMESPACE') as string) ||
                    `${this.name}:*`
            );
        }

        return scopedDebugger;
    }
}
