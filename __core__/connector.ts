import { defaultPriority } from './index';
import BaseSubStructure from './baseSubStructure';
import ConnectorMiddleware from './middlewares/connectionMiddleware';

export default class Connector extends BaseSubStructure {
    public startPriority: number = defaultPriority;
    public stopPriority: number = defaultPriority;
    public middlewares: Set<ConnectorMiddleware> = new Set<
        ConnectorMiddleware
    >();

    constructor() {
        super();
    }

    /**
     * The function to start the connector.
     */
    public async start(): Promise<void> {}

    /**
     * The function to stop the connector.
     */
    public async stop(): Promise<void> {}
}
