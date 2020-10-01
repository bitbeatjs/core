import Configuration from './__core__/config';
import Action from './__core__/action';
import ActionMiddleware from './__core__/middlewares/actionMiddleware';
import Connector from './__core__/connector';
import ConnectorMiddleware from './__core__/middlewares/connectorMiddleware';
import Initializer from './__core__/initializer';
import InitializerMiddleware from './__core__/middlewares/initializerMiddleware';
import Middleware from './__core__/middleware';
import Server from './__core__/server';
import ServerMiddleware from './__core__/middlewares/serverMiddleware';
import Task from './__core__/task';
import TaskMiddleware from './__core__/middlewares/taskMiddleware';
import Utility from './__core__/util';
import { Config } from './__core__/interfaces';

export default {
    logDirectory: './logs',
    directories: {
        config: {
            type: Configuration,
            path: './config',
            dependencies: new Set(),
            statusName: 'configurations',
            start: false,
            run: false,
            repeatable: false,
            middlewares: new Set(),
        },
        initializers: {
            type: Initializer,
            path: './initializers',
            dependencies: new Set([
                Configuration,
                Utility,
                Middleware,
                Connector,
            ]),
            start: true,
            run: false,
            repeatable: false,
            middlewares: new Set([InitializerMiddleware]),
        },
        connectors: {
            type: Connector,
            path: './connectors',
            dependencies: new Set([Configuration, Utility, Middleware]),
            start: true,
            run: false,
            repeatable: false,
            middlewares: new Set([ConnectorMiddleware]),
        },
        actions: {
            type: Action,
            path: './actions',
            dependencies: new Set([
                Configuration,
                Utility,
                Middleware,
                Connector,
                Initializer,
            ]),
            start: false,
            run: false,
            repeatable: false,
            middlewares: new Set([ActionMiddleware]),
        },
        middlewares: {
            type: Middleware,
            path: './middlewares',
            dependencies: new Set([Configuration, Utility]),
            start: false,
            run: false,
            repeatable: false,
            middlewares: new Set(),
        },
        servers: {
            type: Server,
            path: './servers',
            dependencies: new Set([
                Configuration,
                Utility,
                Action,
                Middleware,
                Initializer,
                Connector,
            ]),
            start: true,
            run: false,
            repeatable: false,
            middlewares: new Set([ServerMiddleware]),
        },
        tasks: {
            type: Task,
            path: './tasks',
            dependencies: new Set([
                Configuration,
                Utility,
                Middleware,
                Action,
                Connector,
                Initializer,
                Server,
            ]),
            start: false,
            run: true,
            repeatable: true,
            middlewares: new Set([TaskMiddleware]),
        },
        utils: {
            type: Utility,
            path: './utils',
            dependencies: new Set([Configuration]),
            start: false,
            run: false,
            repeatable: false,
            middlewares: new Set(),
        },
    },
} as Config;
