import Server from '../server';
import Middleware from '../middleware';

export default class ServerMiddleware extends Middleware {
    constructor() {
        super();
    }

    /**
     * The function to run before running the provide function.
     */
    public async beforeProvide(server: Server): Promise<void> {}
    /**
     * The function to run after running the provide function.
     */
    public async afterProvide(server: Server): Promise<void> {}
    /**
     * The function to run before running the initialize function.
     */
    public async beforeInitialize(server: Server): Promise<void> {}
    /**
     * The function to run after running the initialize function.
     */
    public async afterInitialize(server: Server): Promise<void> {}
    /**
     * The function to run before running the start function.
     */
    public async beforeStart(server: Server): Promise<void> {}
    /**
     * The function to run after running the start function.
     */
    public async afterStart(server: Server): Promise<void> {}
    /**
     * The function to run before running the stop function.
     */
    public async beforeStop(server: Server): Promise<void> {}
    /**
     * The function to run after running the stop function.
     */
    public async afterStop(server: Server): Promise<void> {}
}
