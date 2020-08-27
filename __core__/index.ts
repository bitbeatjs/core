// import the subclass
import Action from './action';
import { RunParameters, Input, Inputs } from './action';
import ActionMiddleware from './middlewares/actionMiddleware';
import Boot from './boot';
import BaseStructure from './baseStructure';
import Configuration from './config';
import Connector from './connector';
import Connection from './connection';
import ConnectionMiddleware from './middlewares/connectionMiddleware';
import ConnectorMiddleware from './middlewares/connectorMiddleware';
import Events from './events';
import Initializer from './initializer';
import InitializerMiddleware from './middlewares/initializerMiddleware';
import Middleware from './middleware';
import Server from './server';
import ServerMiddleware from './middlewares/serverMiddleware';
import TaskMiddleware from './middlewares/taskMiddleware';
import Status from './status';
import Store from './store';
import Task from './task';
import Utility from './util';
import Result from './result';

// ------------------------------------------------------ //
// ---------------------- DEFAULTS ---------------------- //
// ------------------------------------------------------ //
const defaultPriority = 1000;

// ------------------------------------------------------ //
// --------------------- Interfaces --------------------- //
// ------------------------------------------------------ //

interface Config {
    extends?: string[];
    fileWatcherDelay?: number;
    logDirectory: string;
    directories: {
        [name: string]: DirectorySettings;
    };
}

interface DirectorySettings {
    type: typeof BaseStructure;
    path: string;
    dependencies: Set<typeof BaseStructure>;
    statusName?: string;
    run: boolean;
    start: boolean;
    repeatable: boolean;
    middlewares: Set<typeof Middleware>;
}

interface Constructor {
    new (...args: any[]): any;
}

// ------------------------------------------------------ //
// ----------------------- EXPORTS ---------------------- //
// ------------------------------------------------------ //
export {
    Boot,
    BaseStructure,
    defaultPriority,
    Configuration,
    DirectorySettings,
    Config,
    Initializer,
    Action,
    Server,
    Store,
    ActionMiddleware,
    ConnectionMiddleware,
    InitializerMiddleware,
    ServerMiddleware,
    Middleware,
    Connection,
    Task,
    Status,
    Events,
    Utility,
    Connector,
    TaskMiddleware,
    ConnectorMiddleware,
    Result,
    Constructor,
    RunParameters,
    Inputs,
    Input
};
