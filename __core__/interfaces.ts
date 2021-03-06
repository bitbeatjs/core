import Middleware from './middleware';
import { Class } from 'type-fest';
import Result from './result';
import { LoggerOptions } from 'pino';

/**
 * Interfaces.
 */
interface Config {
    bootFile?: string;
    extends?: string[];
    fileWatcherDelay?: number;
    logDirectory: string;
    logTimeFormat?: LoggerOptions['timestamp'];
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

interface Cache {
    simple: {
        _fileMap: {
            [path: string]: InstanceType<Constructor>;
        };
        _changedFiles: Set<string>;
        _changedRegistered: Set<{
            oldInstance: InstanceType<Constructor> | undefined;
            newInstance: InstanceType<Constructor> | undefined;
        }>;
        [key: string]: any;
    };
}

interface Constructor {
    new (...args: any[]): any;
}

interface Input {
    type: Class;
    required: boolean;
    default?: any;
    example: any;
    description:
        | {
              [language: string]: string;
          }
        | string;
    validate?: (value: any, propertyName: string) => void | Promise<void>;
    format?: (value: any, propertyName: string) => any | Promise<any>;
}

interface Inputs {
    [propertyName: string]: Input;
}

interface RunParameters {
    params: any;
    result: Result;
    raw: any;
}

export type {
    Cache,
    Config,
    Constructor,
    DirectorySettings,
    Input,
    Inputs,
    RunParameters,
};
