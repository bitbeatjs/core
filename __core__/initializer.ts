import { defaultPriority, InitializerMiddleware } from './index';
import BaseSubStructure from './baseSubStructure';

export default class Initializer extends BaseSubStructure {
    /**
     * Set the start priority for the server.
     */
    public startPriority: number = defaultPriority;
    /**
     * Set the stop priority for the server.
     */
    public stopPriority: number = defaultPriority;
    /**
     * Set middlewares for the initializers.
     */
    public middlewares: Set<InitializerMiddleware> = new Set<
        InitializerMiddleware
    >();

    constructor() {
        super();

        if (!this.startPriority) {
            throw new Error('No start priority given.');
        }

        if (!this.stopPriority) {
            throw new Error('No stop priority given.');
        }

        this.next('status', 'stopped');
    }

    /**
     * The function to start the server.
     */
    public async start(): Promise<void> {
        this.next('status', 'started');
    }

    /**
     * The function to stop the server.
     */
    public async stop(): Promise<void> {
        this.next('status', 'stopped');
    }
}
