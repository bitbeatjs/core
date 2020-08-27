import Connector from '../connector';
import Middleware from '../middleware';

export default class ConnectorMiddleware extends Middleware {
    constructor() {
        super();
    }

    /**
     * The function to run before running the provide function.
     */
    public async beforeProvide(connector: Connector): Promise<void> {}
    /**
     * The function to run after running the provide function.
     */
    public async afterProvide(connector: Connector): Promise<void> {}
    /**
     * The function to run before running the initialize function.
     */
    public async beforeInitialize(connector: Connector): Promise<void> {}
    /**
     * The function to run after running the initialize function.
     */
    public async afterInitialize(connector: Connector): Promise<void> {}
    /**
     * The function to run before running the start function.
     */
    public async beforeStart(connector: Connector): Promise<void> {}
    /**
     * The function to run after running the start function.
     */
    public async afterStart(connector: Connector): Promise<void> {}
    /**
     * The function to run before running the stop function.
     */
    public async beforeStop(connector: Connector): Promise<void> {}
    /**
     * The function to run after running the stop function.
     */
    public async afterStop(connector: Connector): Promise<void> {}
}
