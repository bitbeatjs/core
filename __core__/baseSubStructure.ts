import BaseStructure from './baseStructure';
import { boot } from '../index';

export default class BaseSubStructure extends BaseStructure {
  constructor() {
    super();
  }

  /**
   * Override the instanceof method to ensure the compatibility for different versions.
   */
  static [Symbol.hasInstance](instance: BaseStructure): boolean | undefined {
    const name = this.prototype.constructor.name.toString();
    (this.prototype as any)[`_is${name}`] = true;
    boot.debug(`Checking if '${instance.name || instance.constructor.name}' is an instance of ${name} or at least of BaseStructure.`);
    return (instance.constructor.prototype[`_is${name}`] && instance.constructor.prototype[`_is${name}`] === (this.prototype as any)[`_is${name}`]) || instance instanceof BaseStructure;
  }
}