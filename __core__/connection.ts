import StateSubscriber from 'state-subscriber';
import { Socket } from 'net';
import { createHash } from 'crypto';
import { ConnectionMiddleware, Server } from './index';
import { logger } from '../index';
import * as Throttle from 'promise-parallel-throttle';

export default class Connection extends StateSubscriber {
    public secure: boolean;
    public server: Server;
    public id: string;
    public ip: string;
    public raw: Socket;
    public connectionTime: number = Date.now();
    public keepAliveInterval: NodeJS.Timer;
    public checkInterval = 30000;
    private readonly recycleFunction: () => Promise<void>;

    constructor(
        server: Server,
        connection: Socket,
        secure = false,
        recycleFunction: () => Promise<void>
    ) {
        super();
        this.server = server;
        this.ip = connection.remoteAddress as string;
        this.connectionTime = Date.now();
        this.id = createHash('sha3-256')
            .update(`${this.ip}${this.constructor.name}${this.server.name}`)
            .digest('hex');
        this.raw = connection;
        this.secure = secure || false;
        this.next('alive', true);
        this.recycleFunction = recycleFunction;

        this.keepAliveInterval = setInterval(async () => {
            await this.recycleFunction();
        }, this.checkInterval);
    }

    public resetKeepAliveInterval(): void {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = setInterval(async () => {
            await this.recycleFunction();
        }, this.checkInterval);
    }

    public async close(): Promise<void> {
        logger.debug(`Closing connection '${this.id}'.`);

        const connectionMiddlewares = this.server.getMiddlewaresOfType(
            ConnectionMiddleware
        ) as Set<ConnectionMiddleware>;

        // run each connection middleware beforeDestroy method
        await Throttle.all(
            [
                ...connectionMiddlewares,
            ].map((conn: ConnectionMiddleware) => async () =>
                await conn.beforeDestroy(this, this.server)
            ),
            { maxInProgress: 1 }
        );

        // run each connection middleware afterDestroy method
        await Throttle.all(
            [
                ...connectionMiddlewares,
            ].map((conn: ConnectionMiddleware) => async () =>
                await conn.afterDestroy(this, this.server)
            ),
            { maxInProgress: 1 }
        );

        clearInterval(this.keepAliveInterval);
        logger.debug(`Closed connection '${this.id}'.`);
    }
}
