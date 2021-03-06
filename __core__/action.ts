import { Class } from 'type-fest';
import ActionMiddleware from './middlewares/actionMiddleware';
import BaseStructure from './baseStructure';
import Server from './server';
import { Inputs, RunParameters } from './interfaces';

export default class Action extends BaseStructure {
    /**
     * Add a short description to this action.
     */
    description:
        | {
              [language: string]: string;
          }
        | string = {};

    /**
     * Set the action to deprecated.
     */
    deprecated = false;

    /**
     * Set the tags to group actions.
     */
    tags: Set<string> = new Set();

    /**
     * Define servers for this action.
     */
    servers: Set<Server> = new Set<Server>();

    /**
     * Set middlewares for this action, which will be hooking into it.
     */
    middlewares: Set<ActionMiddleware> = new Set<ActionMiddleware>();

    /**
     * The action inputs. Non-listed will be stripped.
     */
    inputs: Inputs = {};

    /**
     * The output
     */
    output: {
        [propertyName: string]: {
            type: Class;
            example: any;
            default?: any;
            required: boolean;
            description:
                | {
                      [language: string]: string;
                  }
                | string;
        };
    } = {
        dateTime: {
            type: String,
            example: new Date().toISOString(),
            required: false,
            description: {
                en:
                    'The default property to show when the response was generated.',
            },
        },
    };

    constructor() {
        super();
    }

    /**
     * Add a server to the action.
     */
    public addServer(server: Server): void {
        this.servers.add(server);
    }

    /**
     * Add a middleware to the action.
     */
    public addMiddleware(middleware: ActionMiddleware): void {
        this.middlewares.add(middleware);
    }

    /**
     * By default the initialize function is overwritten to add the actions to the servers.
     * You can overwrite it or extend it with super.initialize to reuse this.
     */
    public async initialize(): Promise<void> {}

    /**
     * The function to be run when the action is called.
     * Its possible to use this with different types of servers.
     */
    public async run(data: RunParameters): Promise<any> {}
}
