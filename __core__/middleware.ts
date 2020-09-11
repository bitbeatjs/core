import BaseStructure from './baseStructure';

export default class Middleware extends BaseStructure {
    constructor() {
        super();
    }

    /**
     * The function to run before running the provide function.
     */
    public async beforeProvide(instance: BaseStructure): Promise<void> {}

    /**
     * The function to run after running the provide function.
     */
    public async afterProvide(instance: BaseStructure): Promise<void> {}

    /**
     * The function to run before running the initialize function.
     */
    public async beforeInitialize(instance: BaseStructure): Promise<void> {}

    /**
     * The function to run after running the initialize function.
     */
    public async afterInitialize(instance: BaseStructure): Promise<void> {}

    /**
     * The function to run before running the unload function.
     */
    public async beforeUnload(instance: BaseStructure): Promise<void> {}

    /**
     * The function to run after running the unload function.
     */
    public async afterUnload(instance: BaseStructure): Promise<void> {}
}
