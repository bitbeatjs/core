import Action from '../action';
import Middleware from '../middleware';

export default class ActionMiddleware extends Middleware {
    constructor() {
        super();
    }

    /**
     * The function to run before running the provide function.
     */
    public async beforeProvide(action: Action): Promise<void> {}
    /**
     * The function to run after running the provide function.
     */
    public async afterProvide(action: Action): Promise<void> {}
    /**
     * The function to run before running the initialize function.
     */
    public async beforeInitialize(action: Action): Promise<void> {}
    /**
     * The function to run after running the initialize function.
     */
    public async afterInitialize(action: Action): Promise<void> {}
    /**
     * The function to run before running the run function.
     */
    public async beforeRun(data: {
        action: Action;
        result: any;
        raw: any;
    }): Promise<void> {}
    /**
     * The function to run after running the run function.
     */
    public async afterRun(data: {
        action: Action;
        result: any;
        raw: any;
    }): Promise<void> {}
}
