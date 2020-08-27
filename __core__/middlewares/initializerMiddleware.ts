import Initializer from '../initializer';
import Middleware from '../middleware';

export default class InitializerMiddleware extends Middleware {
    constructor() {
        super();
    }

    /**
     * The function to run before running the provide function.
     */
    public async beforeProvide(initializer: Initializer): Promise<void> {}
    /**
     * The function to run after running the provide function.
     */
    public async afterProvide(initializer: Initializer): Promise<void> {}
    /**
     * The function to run before running the initialize function.
     */
    public async beforeInitialize(initializer: Initializer): Promise<void> {}
    /**
     * The function to run after running the initialize function.
     */
    public async afterInitialize(initializer: Initializer): Promise<void> {}
    /**
     * The function to run before running the start function.
     */
    public async beforeStart(initializer: Initializer): Promise<void> {}
    /**
     * The function to run after running the start function.
     */
    public async afterStart(initializer: Initializer): Promise<void> {}
    /**
     * The function to run before running the stop function.
     */
    public async beforeStop(initializer: Initializer): Promise<void> {}
    /**
     * The function to run after running the stop function.
     */
    public async afterStop(initializer: Initializer): Promise<void> {}
}
