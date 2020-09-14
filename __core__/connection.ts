import StateSubscriber from 'state-subscriber';
import { Socket } from 'net';
import { createHash } from 'crypto';
import Server from './server';
import { boot, logger } from '../bin/bootup';

export default class Connection extends StateSubscriber {
    public secure: boolean;
    public server: Server;
    public id: string;
    public ip: string;
    public raw: Socket;
    public connectionTime: number = Date.now();
    public keepAliveInterval: NodeJS.Timer;
    public checkInterval = 30000;
    private readonly recycleFunction: () => Promise<void> | void;

    constructor(
        server: Server,
        connection: Socket,
        secure = false,
        recycleFunction: () => (Promise<void> | void),
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
        clearInterval(this.keepAliveInterval);
        logger.debug(`Closed connection '${this.id}'.`);
    }

    /**
     * Override the instanceof method to ensure the compatibility for different versions.
     */
    static [Symbol.hasInstance](instance: Connection): boolean | undefined {
        const name = this.prototype.constructor.name.toString();
        (this.prototype as any)[`_is${name}`] = true;
        boot.debug(`Checking if '${instance.constructor.name}' is an instance of ${name}.`);
        return (instance.constructor.prototype[`_is${name}`] && instance.constructor.prototype[`_is${name}`] === (this.prototype as any)[`_is${name}`]);
    }
}
