import { merge } from 'lodash';
import BaseStructure from './baseStructure';

export default class Configuration extends BaseStructure {
    /**
     * The default properties which shall be available in each environment.
     */
    public default: {
        [name: string]: any;
    } = {};
    /**
     * The specific properties which shall be available only in one environment.
     */
    [environment: string]: any;

    constructor() {
        super();
    }

    get value(): {
        [property: string]: any;
    } {
        return merge(
            {},
            this.default,
            this[process.env.NODE_ENV?.toLowerCase() as string] || {}
        );
    }

    toJSON(): any {
        return this.value;
    }
}
