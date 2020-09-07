import BaseSubStructure from './baseSubStructure';

export default class Middleware extends BaseSubStructure {
    constructor() {
        super();
    }

    /**
     * The function to run before running the provide function.
     */
    public async beforeProvide(instance: BaseSubStructure): Promise<void> {}

    /**
     * The function to run after running the provide function.
     */
    public async afterProvide(instance: BaseSubStructure): Promise<void> {}

    /**
     * The function to run before running the initialize function.
     */
    public async beforeInitialize(instance: BaseSubStructure): Promise<void> {}

    /**
     * The function to run after running the initialize function.
     */
    public async afterInitialize(instance: BaseSubStructure): Promise<void> {}

    /**
     * The function to run before running the unload function.
     */
    public async beforeUnload(instance: BaseSubStructure): Promise<void> {}

    /**
     * The function to run after running the unload function.
     */
    public async afterUnload(instance: BaseSubStructure): Promise<void> {}
}
