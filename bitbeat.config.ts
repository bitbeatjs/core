import {
    Action,
    ActionMiddleware,
    Config,
    Configuration, ConnectionMiddleware,
    Connector, ConnectorMiddleware,
    Initializer,
    InitializerMiddleware,
    Middleware, Server, ServerMiddleware, Task, TaskMiddleware,
    Utility,
} from './index';

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
            middlewares: new Set([ServerMiddleware, ConnectionMiddleware]),
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