import {
    defaultPriority,
    Status,
    ServerMiddleware,
    ConnectionMiddleware,
} from './index';
import Action from './action';
import Connection from './connection';
import BaseStructure from './baseStructure';
import { filter } from 'lodash';

export default class Server extends BaseStructure {
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

    public getMiddlewaresOfType(
        type: typeof ServerMiddleware | typeof ConnectionMiddleware
    ): Set<ServerMiddleware | ConnectionMiddleware> {
        return new Set(
            filter([...this.middlewares], (item) => item instanceof type)
        );
    }

    public addConnection(conn: Connection): void {
        this.connections.add(conn);
    }

    public getConnection(origin: string): Connection | undefined {
        return [...this.connections].find((conn) => conn.ip === origin);
    }

    public async removeConnection(conn: Connection): Promise<void> {
        await conn.close();
        this.connections.delete(conn);
    }
}
