import StateSubscriber from 'state-subscriber';
import { defaultPriority } from './defaultProperties';

export default class BaseStructure extends StateSubscriber {
    /**
     * Set the structure to enabled or disabled.
     * In both cases, it will be loaded, but not initialized.
     */
    public enable = true;

    /**
     * Name your structure.
     */
    public name = '';

    /**
     * Version your structure for may later easy upgrading without shutting down old versions.
     * The type of versioning is semantic versioning. This means you can use versions like:
     * this.version = 1; or this.version = '1.0.0'; or this.version = 'v2'; or this.version = '42.6.7.9.3-alpha'; (for what reason you will ever need that kind of.. but it's possible)
     */
    public version: string | number = '1.0.0';

    /**
     * Set the initializePriority. Higher means earlier.
     */
    public initializePriority: number = defaultPriority;

    constructor() {
        super();
    }

    /**
     * Use this method to run something once after its constructed or reloaded, not each time.
     * Be aware that this won't run again when the file has not changed.
     * Else use provide.
     */
    public async configure(): Promise<void> {}

    /**
     * Use this method to provide async values e.g. for the configs.
     * Be aware that this is blocking for the next type of loading
     */
    public async provide(): Promise<void> {}

    /**
     * Use this method to initialize anything after its loaded and provided, which means
     * that all instances are completely available and provided
     */
    public async initialize(): Promise<void> {}

    /**
     * Use this method to close something before it's getting recycled. Use it to close stuff
     * opened in initialize or provide for each cycle.
     */
    public async close(): Promise<void> {}

    /**
     * Use this method to destroy something once before it gets unloaded
     * like closing things which were opened in configure.
     */
    public async destroy(): Promise<void> {}
}
