import Middleware from './middleware';

// ------------------------------------------------------ //
// --------------------- Interfaces --------------------- //
// ------------------------------------------------------ //
interface Config {
  extends?: string[];
  fileWatcherDelay?: number;
  logDirectory: string;
  directories: {
    [name: string]: DirectorySettings;
  };
}

interface DirectorySettings {
  type: any;
  path: string;
  dependencies: Set<any>;
  statusName?: string;
  run: boolean;
  start: boolean;
  repeatable: boolean;
  middlewares: Set<typeof Middleware>;
}

interface Constructor {
  new (...args: any[]): any;
}

export {
  Config,
  DirectorySettings,
  Constructor,
};