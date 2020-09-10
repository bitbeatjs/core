import {
    defaultPriority,
} from './index';
import Action from './action';
import Connection from './connection';
import ConnectionMiddleware from './middlewares/connectionMiddleware';
import BaseSubStructure from './baseSubStructure';
import Status from './status';
import ServerMiddleware from './middlewares/serverMiddleware';
import { getInstance } from '../index';

export default class Server extends BaseSubStructure {
    /**
     * The default store for all connections to this server.
     */
    public connections: Set<Connection> = new Set<Connection>();
    /**
     * The default runtime for the server.
     */
    public runtime: any;
    /**
     * Set the actions for the server.
     */
    public actions: Set<Action> = new Set<Action>();
    /**
     * Set the start priority for the server.
     */
    public startPriority: number = defaultPriority;
    /**
     * Set the stop priority for the server.
     */
    public stopPriority: number = defaultPriority;
    /**
     * Start the server in secure mode or not.
     */
    public secure = false;
    /**
     * Set middlewares for the server.
     */
    public middlewares: Set<ServerMiddleware | ConnectionMiddleware> = new Set<
        ServerMiddleware | ConnectionMiddleware
    >();

    constructor() {
        super();

        if (!this.startPriority) {
            throw new Error('No start priority given.');
        }

        if (!this.stopPriority) {
            throw new Error('No stop priority given.');
        }

        // init the connections for the server
        this.next('status', Status.stopped);
    }

    // add a action to the server
    public addAction(action: Action): void {
        this.actions.add(action);
    }

    /**
     * The function to restart the server.
     * This is just a wrapper for stop and start, but can be overwritten.
     */
    public async restart(): Promise<void> {
        await this.stop();
        await this.start();
    }

    /**
     * The function to start the server.
     */
    public async start(): Promise<void> {}

    /**
     * The function to stop the server.
     */
    public async stop(): Promise<void> {}

    /**
     * Get all connection middlewares of the server.
     */
    public getConnectionMiddlewares(): Set<ConnectionMiddleware> {
        return new Set([...this.middlewares]
          .map((instance: any): ServerMiddleware | ConnectionMiddleware | undefined => {
              if (typeof instance === 'function') {
                  return getInstance(instance);
              }

              return instance;
          })
          .filter((x: any) => !!x)
          .filter((instance: any) => instance instanceof ConnectionMiddleware)) as Set<ConnectionMiddleware>
    }

    /**
     * Add a connection to the connections from the server.
     */
    public addConnection(conn: Connection): void {
        this.connections.add(conn);
    }

    /**
     * Get a connection from the connections from the server.
     */
    public getConnection(origin: string): Connection | undefined {
        return [...this.connections].find((conn) => conn.ip === origin);
    }

    /**
     * Remove a connection from the connections from the server.
     */
    public async removeConnection(conn: Connection): Promise<void> {
        await conn.close();
        this.connections.delete(conn);
    }
}
