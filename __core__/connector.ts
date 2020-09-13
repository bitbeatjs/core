import { defaultPriority } from './defaultProperties';
import BaseStructure from './baseStructure';
import ConnectorMiddleware from './middlewares/connectionMiddleware';

export default class Connector extends BaseStructure {
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
