import Server from '../server';
import Middleware from '../middleware';
import Connection from '../connection';

export default class ConnectionMiddleware extends Middleware {
    constructor() {
        super();
    }

    public async beforeCreate(
        connection: Connection,
        server: Server
    ): Promise<void> {}
    public async afterCreate(
        connection: Connection,
        server: Server
    ): Promise<void> {}
    public async beforeDestroy(
        connection: Connection,
        server: Server
    ): Promise<void> {}
    public async afterDestroy(
        connection: Connection,
        server: Server
    ): Promise<void> {}
}
