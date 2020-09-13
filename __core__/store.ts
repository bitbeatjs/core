import StateSubscriber from 'state-subscriber';
import { Logger } from 'pino';
import { FSWatcher, watch } from 'chokidar';
import pino from 'pino';
import { resolve, join } from 'path';
import { filter } from 'lodash';
import { Debugger } from 'debug';
import { ScheduledTask } from 'node-cron';
import { createWriteStream, WriteStream } from 'fs';
import { PassThrough } from 'stream';
import { name as packageName } from '../package.json';
import I18n from './i18n';
import Status from './status';
import BaseStructure from './baseStructure';
import { Constructor, Config, Cache } from './interfaces';
import Task from './task';
import Boot from './boot';
import * as Types from './index';

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
    public startTime = 0;
    public bootTime = 0;
    public readonly initTime: number = Date.now();
    public updateTime: number = Date.now();
    public watcher?: FSWatcher;
    private readonly bootDirectories: Config['directories'];

    constructor(boot: Boot, config: {
        instanceName: string;
        logLevel?: string;
        language?: string;
    }) {
        super();
        this.debug = boot.generateDebugger('store');
        this.bootDirectories = boot.getConfig().directories;

        if (!config.logLevel) {
            config.logLevel = 'info';
        }

        this.i18n = new I18n(config.language);
        this.baseDir = boot.baseDir;
        this.cache = {
            simple: {
                _fileMap: {},
                _changedFiles: new Set(),
                _changedRegistered: new Set(),
            },
        };

        const logPhysical = Boot.getEnvVar('LOG_PHYSICAL', true);
        if (logPhysical) {
            const logThrough = new PassThrough();

            this.logger = pino({
                name: packageName,
                level: process.env.LOG_LEVEL || config.logLevel,
                timestamp: pino.stdTimeFunctions.epochTime,
            }, logThrough);

            this.loggingStream = createWriteStream(resolve(boot.getConfig().logDirectory, `${Date.now().toString()}.log`));
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
        this.logger.debug('Done initializing store.');
        this.next('status', Status.initialized);
    }

    /**
     * Close the store gracefully.
     */
    public async close(): Promise<void> {
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
     * If you are giving in a class it will automatically create an instance of it.
     */
    public async register<Constr extends Constructor>(
        instance: InstanceType<Constr>,
        reboot = true
    ): Promise<InstanceType<Constr>> {
        const createdInstance = await this.createAndAddInstance(
            instance,
        );
        this.next('register', {
            instances: new Set([createdInstance]),
            reboot,
        });
        return createdInstance;
    }

    /**
     * Create and add an instance and run the configure function.
     */
    private async createAndAddInstance<Constr extends Constructor>(
        instance: InstanceType<Constr>,
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

        if (this.registeredInstances.has(instance)) {
            throw new Error('Already registered.');
        }

        await instance.configure();
        this.registeredInstances.add(instance);
        this.linkRegistered(instance);
        this.cache.simple._changedRegistered.add({
            newInstance: instance,
            oldInstance: undefined,
        });
        this.logger.debug(`Registered instance '${instance.name}'.`);
        this.debug(`Registered instance '${instance.name}'.`);
        return instance;
    }

    /**
     * Add a external registered instance to the store as an bulk.
     * This will prevent the instance to reboot each time, but will reboot once after the bulk is added.
     */
    public async registerBulk<Constr extends Constructor>(
        instances: Set<InstanceType<Constr>>,
        reboot = true,
    ): Promise<Set<InstanceType<Constr>>> {
        const outputInstances: Set<InstanceType<Constr>> = new Set();
        for (const entry of instances) {
            const createdInstance = await this.createAndAddInstance(
                entry,
            );
            outputInstances.add(createdInstance);
            this.debug(`Registered instance '${createdInstance.name}'.`);
        }

        this.next('register', {
            instances: outputInstances,
            reboot,
        });
        this.debug(`Registered bulk of instances.`);
        return outputInstances;
    }

    /**
     * Remove an registered instance if available.
     */
    public async unregister<Constr extends Constructor>(
        instance: InstanceType<Constr>,
        reboot = true,
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
        this.debug(`Unregistered instance '${instance.name}'.`);
        this.next('register', {
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
      reboot = true,
    ): Promise<Set<InstanceType<Constr>>> {
        console.log(instances)
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
            this.debug(`Unregistered instance '${entry.name}'.`);
        }

        this.next('register', {
            instances,
            reboot,
        });
        this.debug(`Unregistered bulk of instances.`);
        return instances;
    }

    /**
     * Update a registered instance if available.
     */
    public async registerUpdate<Constr extends Constructor>(
        oldInstance: InstanceType<Constr>,
        newInstance: InstanceType<Constr>,
    ): Promise<InstanceType<Constr>> {
        if (!this.registeredInstances.has(oldInstance)) {
            throw new Error('Not registered.');
        }

        await oldInstance.destroy();
        this.instances.delete(oldInstance);
        this.registeredInstances.delete(oldInstance);
        await this.register(newInstance);
        this.debug(`Updated instance '${oldInstance.name}'.`);
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
                entry.newInstance,
            );
            outputInstances.add(createdInstance);
        }

        this.next('register', {
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
                this.logger.debug(`Instance '${instance.name}' was not found in registered.`);
                this.debug(`Instance '${instance.name}' was not found in registered.`);
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
        this.logger.debug(`Linked ${this.registeredInstances.size} instances.`);
        this.debug(`Linked ${this.registeredInstances.size} instances.`);
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
        if (!type) {
            throw new Error(`Can't fetch an instance of undefined.`);
        }

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
    public getScheduledTask(instance: Task): ScheduledTask | undefined {
        if (!(instance instanceof Task)) {
            return;
        }

        const items = [...this.tasks];
        return items.find((item) => (item as any)._instance === instance);
    }

    /**
     * Stop a scheduled task based on an instance.
     */
    public stopScheduledTask(instance: Task): ScheduledTask | undefined {
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
    public stopAllScheduledTasks(): void {
        [...this.tasks].forEach((task) => task.stop());
        this.debug(`Stopped all tasks.`);
    }

    /**
     * Delete a scheduled task based on an instance.
     */
    public deleteScheduledTask(instance: Task): void {
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
    public clearScheduledTasks(): void {
        [...this.tasks].forEach((task) =>
            this.deleteScheduledTask((task as any)._instance)
        );
        this.debug(`Cleared all tasks.`);
    }
}
