# BITBEAT
## Introduction
### Glossary
1. [Getting started](#getting-started)
2. [Development](#development)
    1. [Configuring the basics](#configuring-the-basics)
    2. [Add existing module / extend core](#add-existing-module-extend-core)
    3. [Basic development](#basic-development)
    4. [Environment variables](#environment-variables)
    5. [Events](#events)
    6. [Instance specific variables](#instance-specific-variables)
    7. [Functions](#functions)
    8. [Default project structure](#default-project-structure)
    9. [Startup cycle](#startup-cycle)
    10. [Structures](#structures)
3. [Do's and Don'ts](#dos-and-donts)
4. [FAQ](#faq)
5. [Deployment](#deployment)
6. [Todos](#todos)

----

### Additional info
#### Possible usecases
##### Lightweight web server
This is maybe the easiest case. You want to run a basic web server with a quick and easy environment, to create new routes and execute actions for it.<br>
For that you will need the core and [web package](#add-existing-module-extend-core) of bitbeat.

##### Blackbox, with no connection available from the outside
Sometimes you just want a script which is running scheduled tasks, but has no accessibility from the outside or no internet connection.<br>
For those you can just keep the core package without any module and create the stuff you need.<br>
Or if you want to easily connect e.g. to a blockchain but don't want to make the server accessible, just install e.g. the [evan-network-module](#add-existing-module-extend-core).

##### Docker cluster
This framework is fitting for almost each case. One case could be, that you want multiple dockers, where each has a different function, e.g. one is a web server, one is a web socket server and so on.<br>
You can easily use the framework for this purpose by using bitbeat for each docker + the module you want to extend. Unfortunately it is not possible to communicate internally for multiple bitbeat instances, but this is on the [todo list](#todos).

## Getting started
!> All examples are in TypeScript to make it easier to understand the types which are being used and to reuse already existing parts.

### Requirements
- Node >= 10

### Generate
#### Using the generator
The easiest way to generate a bitbeat project is by using the yeoman generator.<br>
To do so, install yeoman with `npm i -g yo` or `yarn global add yo` and install the generator by using `npm i -g generator-bitbeat` or `yarn global add generator-bitbeat`. Then run `yo bitbeat`.<br>
This will guide you through the process of generating a project structure and install the packages for you.

<a href="https://asciinema.org/a/TK8RXDvmZTdViZ4Zp0Nkxhsks" target="_blank"><img src="https://asciinema.org/a/TK8RXDvmZTdViZ4Zp0Nkxhsks.svg" /></a>

----

#### Using the plain install method
Install the bitbeat package by using `npm i -S @bitbeat/core` or `yarn add @bitbeat/core` and create the [default needed folders](#default-project-structure).<br>
You then need to add the start command by adding it to the <b>package.json</b> `"start": "node ./node_modules/@bitbeat/core/bin start"`.<br>
If you need more than just the core, take a look at [adding packages to it](#add-existing-module-extend-core).

## Development
### Configuring the basics
It is possible to change or extend the directories, which are being watched and loaded. To do so, you need to create file like `bitbeat.local.config.js`.
```typescript
import { BaseStructure } from '@bitbeat/core';

export default {
    extends: ['bitbeat.config.js'], // this is optional, makes it easier to create basic files and extend them for different environments
    fileWatcherDelay: 300, // this is optional, use a bigger delay if your filesystem is slow, to prevent multiple reloads while e.g. copying files to the directories. Default is 100
    directories: {
        hello: {
            type: BaseStructure,
            path: './hello',
            dependencies: new Set(),
            middlewares: new Set(),
            start: true,
            repeatable: false,
            run: false,
        }
    },
};
```

and then add the config param when starting `node ./node_modules/@bitbeat/core/bin start --config bitbeat.local.config.js` (use `node ./node_modules/@bitbeat/core/bin --help` to see the options).<br>

!> <b>To ensure the core functionalities, the basic config is always getting extended,</b> but it is possible to overwrite the paths for each core directory.

----

### Add existing module / extend core
Of course the core package of bitbeat is a bit plain, which is intended but may not always useful, e.g. if you want to have a web server or websocket server or both.
It's pretty easy to add one of these modules to the core or even create your own and add it. For this you will need to use the [register/registerBulk](#register-registerbulk).
Check out some official modules available (more modules will follow):

-   [@bitbeat/web]() (web server module based on [fastify](https://www.fastify.io/))
-   [@bitbeat/websocket]() (web socket server module based on [ws](https://github.com/websockets/ws))
-   [@bitbeat/python]() (python module)
-   [@bitbeat/evan-network]() (blockchain module based on the [evan.network](https://evan.network/))
-   [@bitbeat/cluster]() (clustering module)

Community modules:
- Be the first to provide one!

Now initially the bitbeat is searching for a `boot.js`, which will be run before the whole core is getting initialized. To add a web server package to the core, you need to do something like this:
```typescript
import { registerBulk, getInstance } from '@bitbeat/core';
import {
    WebServer,
    WebServerConfig,
} from '@bitbeat/web';

export default async () => {
    await registerBulk(
        new Set([
            {
                instance: WebServerConfig,
                createInstance: true,
            },
            {
                instance: WebServer,
                createInstance: true,
            },
        ])
    );
};
```

To get detailed information about each package, please watch the documentation in each of them.

----

### Basic development
#### 1. File watching for .ts files (only when using TypeScript)
If you use TypeScript, you should run initially the `npm run watch` command, which will compile all the files to js files. You should keep this command running as long as you are developing, to ensure each change in the TypeScript files gets compiled.<br>

!> The reason why there is no real building pipe with gulp generated is, that mostly you just this basic building with `tsc` to build files. If you need it, you can copy the examples from the core package repo.

<a href="https://asciinema.org/a/oYppkYjHhmpsR2sTdYfTIwdTP" target="_blank"><img src="https://asciinema.org/a/oYppkYjHhmpsR2sTdYfTIwdTP.svg" /></a>

#### 2. Start the framework
After the compiling, you can start the core by using `npm run start` and start developing your structures and do cool stuff.<br>
<br>
<a href="https://asciinema.org/a/wMUYTSJtCCb4Y4Pg0GZ6okAYo" target="_blank"><img src="https://asciinema.org/a/wMUYTSJtCCb4Y4Pg0GZ6okAYo.svg" /></a>

!> This is a boot up done on Ubuntu Linux 64-bit. The boot up time may change, depending on the system you are using and the modules included.

#### 3. Restarts only the necessary things on each change
After each change, the core should reboot depending on what structure you have changed. In this example, I have changed a task instance and added a log for each run.<br>
<br>
<a href="https://asciinema.org/a/F60DZJKVqNnDaYpKzJWafWuUg" target="_blank"><img src="https://asciinema.org/a/F60DZJKVqNnDaYpKzJWafWuUg.svg" /></a>

#### Node env

Set a specific environment, where you want to run the bitbeat in.

##### Development
As long as the development isn't production, there are no core functionalities, which depend on them, so you are free to use the env you want and implement stuff which depend on your specific environments.<br>
<br>
`NODE_ENV=local` or `NODE_ENV=development` or `NODE_ENV=xxx`

----

##### Production
The file watcher will be disabled if you are using the production environment and the logger won't print pretty, to boost the performance.<br>

!> By default node will always use <b>production</b>.

`NODE_ENV=production`

----

#### Logger
For the logger there are 3 different env vars.<br>

##### Log level
This is defining the level which will be logged out. For those you can take a look at [pino](https://github.com/pinojs/pino).<br>
<br>
`LOG_LEVEL=debug`

##### Log pretty
This is disabling the pretty print and will log now only in json format, which improves the performance.<br>
This is enabled by default in `NODE_ENV=production`, but can be manually disabled in other environments.<br>
<br>
`LOG_DISABLE_PRETTY_PRINT=1`

##### Log physical
The third one is `LOG_PHYSICAL`. If you are setting this to true, the logger will write in the directory configured in your `bitbeat.config.js`.<br>
When using this, pretty print will be turned off to improve to performance of streaming to a file and logging into the console.<br>
<br>
`LOG_PHYSICAL=1`

!> Be aware writing of physical log files may affect the performance. For that reason, it is <b>disabled by default</b>.

----

#### Namespace and scoped
Well what happens when you have the same env vars in another lib or in another context in your project? How can you then use the bitbeat env vars?<br>
Scoped to the rescue!<br>
If you are setting that to true, it will add a `BITBEAT_` prefix in front of all env vars which you can use.

!> `LOG_LEVEL` and `NODE_ENV` won't be scoped, because there should be no case to split the bitbeat ENV and LOG_LEVEL from the rest of the project.<br>

`BITBEAT_SCOPED=true` or `BITBEAT_SCOPED=1`

This means `LOG_PHYSICAL` is getting ignored by bitbeat and `BITBEAT_LOG_PHYSICAL` is the new variable. This works for all other env vars.

----

#### Benchmark and debugger
Now sometimes you don't want to set the `LOG_LEVEL=debug` to debug the application at the log level and may also want to see some performance logs.<br>
Also if you are at production stages, it is sometimes impossible to use a real debugger.<br>
Set this variable to true, to use the advantages of [debug](https://github.com/visionmedia/debug) to show you all debug logs and performances at once.<br>

!> Each package has its own debug instance to make the output as detailed as possible. The name is `BITBEAT_DEBUG`, cause `DEBUG` is too general and will clash with others.

`BITBEAT_DEBUG=true` or `BITBEAT_DEBUG=1`

<a href="https://asciinema.org/a/xAlkxi8EzLdw6i8JhRP27C9w3" target="_blank"><img src="https://asciinema.org/a/xAlkxi8EzLdw6i8JhRP27C9w3.svg" /></a>

To debug only a specific namespace, there is also an environment variable called `BITBEAT_DEBUG_NAMESPACE`. Just declared it for example like `BITBEAT_DEBUG_NAMESPACE=@bitbeat/core:store` to only enable the store debugs and disable the rest.

!> All namespaces generated by `generateDebugger` are available in '@bitbeat/core:xxx'. These namespaces also work with wildcards.

----

### Events
!> <b>Each instance you are creating is based on an event emitter</b>.<br>

In detail it's using the [state-subscriber](https://github.com/QuadroKnoX/state-subscriber) package of me, which is a wrapper around the [EventEmitter2](https://github.com/EventEmitter2/EventEmitter2) package. For details about the events and how to use them, take a look there.<br>
<br>
This means, if you create a new Server, Task, Action or anything else, each of it <b>can emit data you can subscribe to</b>.<br>
This allows you to easily develop things like a web crawler, queues or anything which should not be awaited but subscribed to, to prevent blocking the whole core.<br>
<br>
Just use `this.next('event', value)` or `this.emit('event', value)` inside of your class to emit data and subscribe to it by e.g. getting the instance with the [getInstance](#getinstance) function and use `getInstance(TestClass)?.subscribe('event', (data) => doStuff())` or `getInstance(TestClass)?.on('event', (data) => doStuff())`.<br>
<br>
Some examples for that can be found in the automatic tests.

----

### Instance specific variables
Often you want to add your own variables like e.g. connections for the server or something else. These things will be declared in the instance itself. If you want to access them, just use the `getInstance` function, fetch the instance and use the var like `getInstance(MyServer)?.connections`;

!> There is no global scope of variables. You have access to all vars by fetching the instance and accessing it there.

----

### Functions
#### Local functions
These are the functions available in each instance or in specific types of instances.

##### General
###### configure
This function will be loaded once, when the instance gets loaded from the file system. As long as that file doesn't change, or the registered instance doesn't get updated, this function won't run again.<br>
The opposite of this function is the [destroy](#destroy) function.

```typescript
import { Server } from '@bitbeat/core';

export default class Test extends Server {
    constructor() {
        super();
    }

    async configure() {
        console.log('Hey I will run only if the physical file or registered instance has changed.');
    }
}
```

----

###### provide
The provide function has a similar intense like the [configure](#configure) function, but this will run each time for each instance when bitbeat reboots.<br>
This will also run after each instance type loading, which means e.g. you can access a configuration from a utility but not the other way around. To do so, use the [initialize](#initialize) function.
The opposite of this function is the [close](#close) function.

```typescript
import { Server } from '@bitbeat/core';

export default class Test extends Server {
    constructor() {
        super();
    }

    async provide() {
        console.log('Hey I will run always if the physical file or registered instance type has changed.');
    }
}
```

----

###### initialize
The initialize function is similar to the [provide](#provide) function, but runs after each instance is loaded up, which means you can access each kind of instance from the other.<br>
The opposite of this function is the [close](#close) function.

```typescript
import { Server } from '@bitbeat/core';

export default class Test extends Server {
    constructor() {
        super();
    }

    async initialize() {
        console.log('Hey I will run always if the physical file or registered instance type has changed.');
    }
}
```

----

###### close
This function will run each time bitbeat reboots. It's intended to close open connections done in provide or initialize.<br>
The opposite of this function is the [provide](#provide) or [initialize](#initialize) function.

```typescript
import { Server } from '@bitbeat/core';

export default class Test extends Server {
    constructor() {
        super();
    }

    async close() {
        console.log('Hey I will run always if the physical file or registered instance type has changed.');
    }
}
```

----

###### destroy
This function will run once the instance gets completely destroyed. It's intended to close open connections done in configure.<br>
The opposite of this function is the [configure](#configure) function.

```typescript
import { Server } from '@bitbeat/core';

export default class Test extends Server {
    constructor() {
        super();
    }

    async destroy() {
        console.log('Hey I will run only if the physical file or registered instance has changed.');
    }
}
```

##### Specific
###### run
This function is available for the following types: [Actions](#actions) and [Tasks](#tasks).<br>
It will run each time the task runs or you are triggering an action.

```typescript
import { Task } from '@bitbeat/core';

export default class Test extends Task {
    constructor() {
        super();
        this.schedule = '* * * * * *';
    }

    async run() {
        console.log('This log will be shown each second.');
    }
}
```

----

###### start
This function is available for the following types: [Connectors](#connectors), [Initializers](#initializers) and [Servers](#servers).<br>
It will define what to do, when the server starts.

```typescript
import { Server } from '@bitbeat/core';

export default class Test extends Server {
    constructor() {
        super();
    }

    async start() {
        console.log('Started test server.');
    }
}
```

----

###### stop
This function is available for the following types: [Connectors](#connectors), [Initializers](#initializers) and [Servers](#servers).<br>
It will define what to do, when the server stops.

```typescript
import { Server } from '@bitbeat/core';

export default class Test extends Server {
    constructor() {
        super();
    }

    async stop() {
        console.log('Stopped test server.');
    }
}
```

#### Global functions
!> Each function for instances is either returning an instance, `undefined` or a Set of instances. You will never get back an array.

##### getInstance

The main function you will need is the `getInstance` function. With that, you will be able to fetch a created instance of a class by its type.<br>
Optionally you can put in the name and/or version, to set it to a fixed one, e.g. `getInstance(TestClass, 1)` will always return the version 1 of that instance, while just `getInstance(TestClass)` will always return the latest.

!> This is the common way to fetch a created instance.

```typescript
import { getInstance, Server } from '@bitbeat/core';
import ServerConfig from '../config/serverConfig';

export default class Test extends Server {
    async start() {
        const config = getInstance(ServerConfig);
    }
}
```

Now there is another way to use it. For example if you don't want to import the class itself, you can use a string for that.

```typescript
import { getInstance, Server, Configuration } from '@bitbeat/core';

export default class Test extends Server {
    async start() {
        const config = getInstance(Configuration, 'ServerConfig');
    }
}
```

Here is the example to get a fixed version:

```typescript
import { getInstance, Server, Configuration } from '@bitbeat/core';

export default class Test extends Server {
    async start() {
        const config = getInstance(ServerConfig, 1);
    }
}
```

or 

```typescript
import { getInstance, Server, Configuration } from '@bitbeat/core';

export default class Test extends Server {
    async start() {
        const config = getInstance(Configuration, 'ServerConfig', 1);
    }
}
```
----

##### getInstanceByName

If you don't want to import the class or the root class itself in the file, you can use the `getInstanceByName` function. It works similar to the `getInstance` function, but needs a name of an instance instead of the class (and the name).<br>

```typescript
import { getInstanceByName, Server } from '@bitbeat/core';

export default class Test extends Server {
    async start() {
        const config = getInstanceByName('ServerConfig');
    }
}
```

----

##### getInstancesOfType

Sometimes you need to retrieve all instances of a type, e.g. for a server and its special actions. This will return a Set of instances.

```typescript
import { getInstancesOfType, Server } from '@bitbeat/core';
import { WebAction } from 'bitbeat-web';

export default class Test extends Server {
    async start() {
        const actions = getInstancesOfType(WebAction);
    }
}
```

----

##### register / registerBulk

Now there are cases, where you don't want to create a physical file for an instance. For those cases, there is the `register` and `registerBulk` function.
The `registerBulk` function takes a Set of instances as params, not an array to ensure a pre-unification.

```typescript
import { register, registerBulk, Server } from '@bitbeat/core';
import { WebAction } from '@bitbeat/web';

export default class Test extends Server {
    async start() {
        // generate an instance by your code.
        const basicAction = new WebAction();
        await register(basicAction);

        // or let the framework generate an instance.
        // note that you can't any custom code for the instance then.
        await register(WebAction, true);

        // or register both as a bulk, to prevent multiple reloads.
        await registerBulk(
            new Set([
                {
                    instance: basicAction,
                },
                {
                    instance: WebAction,
                    createInstance: true,
                },
            ])
        );
    }
}
```

This principal will be also used in the boot.ts for each project. There you can register instances of other modules, e.g. add a web-server for your project.

!> By default the core will reboot when you register an instance. You can prevent this by passing `false` as second parameter.

----

##### unregister / unregisterBulk

Sometimes you need to unregister registered instances again. To do so, use either the `unregister` function, to only remove a single instance or `unregisterBulk`, to remove multiple.<br>

```typescript
import { unregister, Task } from '@bitbeat/core';
import MyConfiguration from '../config/myConfig';

export default class Test extends Task {
    async configure() {
        const myConfiguration = getInstance(MyConfiguration);
        await unregister(myConfiguration);
        // this function will delay everything until the restart is done
        await boot.awaitRegister();
    }
}
```

!> By default the core will reboot when you unregister an instance. You can prevent this by passing `false` as second parameter.

----

#### registerUpdate

```typescript
import { getInstance, registerUpdate, Task, boot } from '@bitbeat/core';
import MyServer from '../servers/myServer';
import MyConfiguration from '../config/myConfig';

export default class Test extends Task {
    async configure() {
        const myServer = getInstance(MyServer);
        const myNewServer = myServer;
        
        if (!myServer || !myNewServer) {
            throw new Error('Could not find server.');
        }
        
        myNewServer.start = async () => {
            const testConfig = getInstance(MyConfiguration);
            console.log(testConfig?.value.name);
            console.log('Started.');
        };
        await registerUpdate(myServer, myNewServer);
        // this function will delay everything until the restart is done
        await boot.awaitRegister();
    }
}
```

---- 

##### getAllInstances

In some edge cases, you may need to get all instances which are existing. For those cases, there is the `getAllInstances` function, which will return a Set of instances.

```typescript
import { getAllInstances, Server } from '@bitbeat/core';

export default class Test extends Server {
    async start() {
        // get all instances, for whatever purpose
        const instances = getAllInstances();
    }
}
```

----

##### generateDebugger
The easiest way to generate a debugger in the way the core package and the modules are generating it, is to use this function.<br>
It will return an instance of the debugger and will enable it if the environment variable is set. The common way is to create the debugger in the `configure` cycle, to just create it once and not on each reboot.

```typescript
import { Server, boot } from '@bitbeat/core';
import { Debugger } from 'debug';

export default class Test extends Server {
    debug: Debugger | any;

    async configure(): Promise<void> {
        this.debug = boot.generateDebugger(this.name);
    }

    async start() {
        this.debug(`${this.name} started.`);
    }

    async stop() {
        this.debug(`${this.name} stopped.`);
    }
}
```

----

### Default project structure

The project has a default structure:

```
bitbeat instance
|
└─── actions
│   │   action1.ts
|   │   ...
|   |
│   └───subfolder1
│       │   action2.ts
│       │   ...
|
└─── config
|   │   config1.ts
|   │   ...
|
└─── connectors
|   │   connector1.ts
|   │   ...
|
└─── initializers
|   │   initializer1.ts
|   │   ...
|
└─── locales
|   │   de.ts
|   │   ...
|
└─── log
|   │   combined.log
|   │   ...
|
└─── middlewares
|   │   middleware1.ts
|   │   ...
|
└─── public
|   │   index.html
|   │   ...
|
└─── servers
|   │   server1.ts
|   │   ...
|
└─── utils
|   │   util1.ts
|   │   ...
|
└─── tasks
    │   task1.ts
    │   ...
```

Make sure if you have custom directories, to [configure them properly](#configuring-the-basics).

----

### Startup cycle

1. [Configurations](#configurations)
2. [Utilities](#utilities)
3. [Middlewares](#middlewares)
    1. [ActionMiddleware](#action-middlewares)
    2. [ConnectionMiddleware](#connection-middlewares)
    3. [ConnectorMiddleware](#connector-middlewares)
    4. [InitializerMiddleware](#initializer-middlewares)
    5. [ServerMiddleware](#server-middlewares)
    6. [TaskMiddleware](#task-middlewares)
4. [Connectors](#connectors)
5. [Initializers](#initializers)
6. [Actions](#actions)
7. [Servers](#servers)
8. [Tasks](#tasks)

This startup order means, that you can access from each the previous loaded steps, but not the next.

----

### Structures
To export a created structure, use `export default class xxx extends yyy {}`, but a non-default export like `export class xxx extends yyy {}` works too.<br>

!> You can export multiple classes in a single file and load them, but make sure <b>the type of created structures match the directory inheriting type</b>, else bitbeat won't be able to do some functions properly.

#### Configurations
In a configuration instance you are defining environment specific configs and persistent information, which you can provide to the upcoming instances.

##### Definition

```typescript
import { Configuration } from '@bitbeat/core';
export default class MyConfiguration extends Configuration {
    // default always has to be exported
    default = {
        // set a property to 1 as default
        myProperty: 1,
    };
    local = {
        // overwrite it only in local environment with 2
        myProperty: 2,
    };

    constructor() {
        super();
        this.name = 'myName'; // this is optional. If not set, the class name will be used.
    }
}
```


##### Usage

```typescript
import { getInstance, Server } from '@bitbeat/core';
import MyConfiguration from '../config/myConfig';

export default class MyServer extends Server {
    async start() {
        const config = getInstance(MyConfiguration);
    }
}
```

----

#### Utilities

Utilities or Helpers are instances, which contain centralized functions, which will be used in different classes.

##### Definition

```typescript
import { Utility } from '@bitbeat/core';
import { createHash } from 'crypto';

export default class CryptoUtility extends Utility {
    constructor() {
        super();
    }

    hash(content: string): string {
        return createHash('sha3-256').update(content).digest('hex');
    }
}
```

##### Usage

```typescript
import { getInstance, Initializer } from '@bitbeat/core';
import CryptoUtility from '../utils/cryptoUtility';

export default class MyInitializer extends Initializer {
    constructor() {
        super();
    }

    async start(): Promise<void> {
        console.log(getInstance(CryptoUtility)?.hash('test'));
    }
}
```

----

#### Middlewares

##### Action middlewares

###### Usage

```typescript
import { ActionMiddleware, Action } from '@bitbeat/core';

export default class MyActionMiddleware extends ActionMiddleware {
    constructor() {
        super();
    }

    async beforeRun(action: Action, result: any, raw: any): Promise<void> {
        console.log('Hey I am doing something before the action');
    }

    async afterRun(action: Action, result: any, raw: any): Promise<void> {
        console.log(
            'Hey I am doing something after the action and here is the result:',
            result
        );
        console.log(Date.now());
    }
}
```

----

##### Connection middlewares

###### Usage

```typescript
import { Server, ConnectionMiddleware } from '@bitbeat/core';
import { Socket } from 'net';

export default class MyConnectionMiddleware extends ConnectionMiddleware {
    constructor() {
        super();
    }

    async beforeCreate(connection: Socket, server: Server): Promise<void> {
        // throw new Error('Sorry no trespassing.');
    }

    async beforeDestroy(connection: Socket, server: Server): Promise<void> {
        console.log(connection);
    }
}
```

----

##### Connector middlewares

###### Usage

```typescript
import { Server, ConnectorMiddleware } from '@bitbeat/core';

export default class MyConnectorMiddleware extends ConnectorMiddleware {
    constructor() {
        super();
    }
}
```

----

##### Initializer middlewares

###### Usage

```typescript
import { InitializerMiddleware } from '@bitbeat/core';

export default class MyInitializerMiddleware extends InitializerMiddleware {
    constructor() {
        super();
    }
}
```

----

##### Server middlewares

###### Usage

```typescript
import { ServerMiddleware, Server } from '@bitbeat/core';

export default class MyServerMiddleware extends ServerMiddleware {
    constructor() {
        super();
    }

    async beforeStart(server: Server): Promise<void> {
        console.log('Starting server finally...');
    }

    async afterStart(server: Server): Promise<void> {
        console.log('Started server finally.');
    }

    async beforeStop(server: Server): Promise<void> {}

    async afterStop(server: Server): Promise<void> {}
}
```

----

##### Task middlewares

###### Usage

```typescript
import { TaskMiddleware, Task } from '@bitbeat/core';

export default class MyTaskMiddleware extends TaskMiddleware {
    constructor() {
        super();
    }

    async beforeRun(task: Task): Promise<void> {
        try {
            // do something
        } catch (e) {
            throw e;
        }
    }

    async afterRun(task: Task): Promise<void> {
        try {
            // do something
        } catch (e) {
            throw e;
        }
    }

    async beforeUnload(task: Task): Promise<void> {
        try {
            // do something
        } catch (e) {
            throw e;
        }
    }
}
```

----

#### Connectors

A connector is basically a connection to an external system, e.g. database connection or web socket connections.

##### Usage

```typescript
import { Connector, Configuration, logger } from '@bitbeat/core';
import { Driver } from 'neo4j-driver';

export default class Neo4jConnector extends Connector {
    runtime: Driver | undefined;

    constructor() {
        super();
        this.startPriority = 1005;
        this.stopPriority = 1005;
    }

    async start() {
        // get the neo4j configuration
        const config = getInstance(Configuration, 'Neo4j');
        // create the driver for the database
        this.runtime = neo4j.driver(
            uri || 'bolt://localhost:7687',
            neo4j.auth.basic(
                config?.value.auth.user,
                config?.value.auth.password
            ),
            {
                disableLosslessIntegers: true,
            }
        );
        // verify the connection
        await this.runtime.verifyConnectivity();
        logger.info('Connected to Neo4j.');
    }

    async stop() {
        // disconnect
        await this.runtime?.close();
        logger.info(`Closed neo4j connection.`);
    }
}
```

----

#### Initializers
What's the difference between a [Connector](#connectors) and an Initializer? Well currently it's just a concept of splitting external connections and internal initializings and it's more a dependency reload optimizer, which means if you have created a connector and then just work at the initializer, the connectors won't reload and reconnect all the time. Maybe there are more functionalities in the future.

##### Definition

```typescript
import { logger, Initializer } from '@bitbeat/core';

export default class MyInitalizer extends Initializer {
    constructor() {
        super();
        this.name = 'Test2';
        this.startPriority = 1005;
        this.stopPriority = 1000;
    }

    async start() {
        logger.info('test 2');
    }
}
```

##### Usage

```typescript
import { logger, getInstance } from '@bitbeat/core';
import MyInitializer from '../initializers/MyInitializer';

export default class MyServer extends Server {
    constructor() {
        super();
        this.name = 'Test2';
        this.startPriority = 1005;
        this.stopPriority = 1000;
    }

    async start() {
        console.log(getInstance(MyInitializer))
    }
}
```

----

#### Actions
An action is a one time running function. Now you can access them everywhere and you could use them as:
- Web server route
- Web socket server action
- Task function which is called by a task instance
- Connector which runs the connection action
- even more...

##### Definition

```typescript
import { Action } from '@bitbeat/core';

export default class MyAction extends Action {
    constructor() {
        super();
        this.name = 'bla.test';
        this.inputs = {};
    }

    async run(data: {
        params: any;
        result: Result;
        raw: any;
    }) {
        try {
            // you can either extend the result or return something
            Object.assign(data.result, data.params);
        } catch (e) {
            throw e;
        }
    }
}
```

##### Usage
```typescript
import { getInstance, Server } from '@bitbeat/core';
import MyAction from '../actions/MyAction';

export default class MyServer extends Server {
    constructor() {
        super();
        this.name = 'server';
    }

    async start() {
        try {
            await getInstance(MyAction)?.run({
                ...stuff
            });
        } catch (e) {
            throw e;
        }
    }
}
```

----

#### Servers
A server can be anything that should be accessible from a client, app, server or whatever like a web server, socket server, web socket server or anything else.

##### Definition

```typescript
import { logger, Server, Status } from '@bitbeat/core';

export default class TestServer extends Server {
    runtime: any;

    constructor() {
        super();
        this.startPriority = 300;
        this.stopPriority = 400;
        this.middlewares = {
            server: [],
            connection: [],
        };
    }

    async start() {
        console.log('started fake server.');
    }

    async stop() {
        console.log(`stopped fake server.`);
    }
}
```

##### Usage

```typescript
import { Task, getInstance } from '@bitbeat/core';
import TestServer from '../servers/testServer.ts';

export default class TestTask extends Task {
    constructor() {
        super();
        this.name = 'bla.test';
        this.schedule = '* * * * * *';
    }

    async run(): Promise<void> {
        await getInstance(TestServer)?.restart();
    }
}
```

----

#### Tasks
A task is like an action that runs by the cron schedule your are defining. So you could crawl stuff incrementally, restart servers after some hours, ping services or whatever you like to do. 

##### Usage

```typescript
import { Task, getInstance } from '@bitbeat/core';
import MyConnector from '../connectors/myConnector';

export default class TestTask extends Task {
    constructor() {
        super();
        this.schedule = '* * * * *'; // run it each minute
        this.limit = 1; // run this task only once
        this.runInitially = true; // run it right on boot
    }

    async run(): Promise<void> {
        const connector = getInstance(MyConnector);
        await connector?.fetchMyData();
    }
}
```

In this example it's like fetching data from external systems based on [connectors](#connectors) incrementally.

----

## Do's and Don'ts
### Use npm instead of yarn for developing local packages
The current problem with yarn are the symlinks of local packages. By importing a local package class, it will be recognized as a class which is extending a second different package of @bitbeat/core, which is not the same as the runtime @bitbeat/core package. That means if you are using `instanceof`, js will never say true, because the class you are checking will always have a different parent class. It's like `@bitbeat/core1 !== @bibeat/core2`, but with npm it's working fine.<br>
So if you are having this problem, remove the node_modules, remove the yarn.lock and use `npm install` instead.

!> This issue was tested with yarn version 1.22.4.

### Defining a new class

When you are creating a new package, always depend on the existing classes. If you want to create a new server, extend the server class.<br>
If neither of the classes are matching, extend the BasicStructure class. Else the inheritance of the framework concept will be broken.<br>
<br>
<b>Wrong:</b>
```typescript
export default class MyAweSomeClass {}
```

This will also throw an error, because bitbeat is checking if the created class is an instance of the BaseStructure class.<br>
To ensure some main advantages, it is not possible to create your own class without this inheritance.

<b>Right:</b>
```typescript
import { BasicStructure } from '@bitbeat/core';
export default class MyAweSomeClass extends BasicStructure {}
```

----

### Defining and using classes on runtime

Let's assume you want to generate a class on runtime and register it. Well that's possible BUT don't do something like this:

```typescript
import { Task, Server, register, getInstance } from '@bitbeat/core';

export default class TestTask extends Task {
    constructor() {
        super();
        this.schedule = '* * * * * *';
        this.limit = 1;
    }

    async run() {
        class TestServer extends Server {
            async start() {
                console.log('started');
            }

            async stop() {
                console.log('stopped');
            }
        }
        let server = getInstance(TestServer);
        if (!server) {
            server = new TestServer();
            register(server);
        }
    }
}
```

This could also be an action or anything, so don't mind the Task class. This will generate a new class in each run, which will result in getInstance will return undefined. Then it will generate a new Server and then this will loop.
The correct way is to create the class not in these loops. Generate it outwards of these watched directories or outwards of loaded file class, which will not be reloaded. If needed manipulate the properties, but not the class itself.
For example:

```typescript
import { Task, Server, register, getInstance } from '@bitbeat/core';

class TestServer extends Server {
    async start() {
        console.log('started');
    }

    async stop() {
        console.log('stopped');
    }
}

export default class TestTask extends Task {
    constructor() {
        super();
        this.schedule = '* * * * * *';
        this.limit = 1;
    }

    async run() {
        let server = getInstance(TestServer);
        if (!server) {
            server = new TestServer();
            register(server);
        }
    }
}
```

----

## FAQ
### Can I use .js instead of .ts?

Of course, you can. Everything is build up on TypeScript to make maintainability easier, but the files which are loaded are .js files.<br>
That means if you want to skip the compilation step, it's fine. Just make sure, you are exporting the class you are creating like shown in the TypeScript examples.

----

## Deployment
### Docker
If you want to deploy it in a docker, there is a docker-compose.yml and a Dockerfile in the repository, which gives you an example of how to dockerize it.

### Zip deploy
If you want to physically deploy the project, then there is a zip-script in the bin folder, which zips you the necessary folders.

----

## Todos
Here is a list of things I've already planned to implement in the future:
- [ ] Overthink the directory bind logic / remove the directory binding
- [ ] Add worker threads to improve heavy load performance (complex issue due to https://github.com/nodejs/help/issues/1558 and https://github.com/nodejs/worker/issues/6)
- [ ] Add clustering
- [x] Provide the framework to the humans

## Support
If you like bitbeat, consider giving it a star on github and watch it for updates to spread it to others in the community.
<iframe style="border: 0" src="https://ghbtns.com/github-btn.html?user=bitbeatjs&repo=core&type=star&count=true" frameborder="0" scrolling="0" width="150" height="20" title="GitHub"></iframe>
<iframe style="border: 0" src="https://ghbtns.com/github-btn.html?user=bitbeatjs&repo=core&type=watch&count=true&v=2" frameborder="0" scrolling="0" width="150" height="20" title="GitHub"></iframe>

## Success stories and projects using bitbeat
May send me a message with your project which is using bitbeat to link it in here.<br>
Be the first!