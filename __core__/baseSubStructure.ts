import { merge } from 'lodash';
import { getInstance } from '../index';
import BaseStructure from './baseStructure';
import Configuration from './config';

export default class BaseSubStructure extends BaseStructure {
  /**
   * Set the configs for this instance.
   */
  public configurations: Set<Configuration> = new Set();

  constructor() {
    super();
  }

  /**
   * Use this method to get back the merged configurations set in the this.configurations property.
   * This is useful when you want to not only have a single configuration.
   */
  public get config(): Configuration['value'] {
    return merge({}, ...([...this.configurations].map((config) => {
      let instance: Configuration = config;
      if (typeof config === 'function') {
        const fetchedInstance = getInstance(config);

        if (!fetchedInstance) {
          return;
        }

        instance = fetchedInstance;
      }

      return instance?.value;
    })));
  }
}