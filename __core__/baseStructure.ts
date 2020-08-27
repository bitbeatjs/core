import StateSubscriber from 'state-subscriber';
import { defaultPriority } from './index';

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
     */
    public version = 1;

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
}
