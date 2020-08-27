import { Redis } from 'ioredis';

export default interface Cache {
    simple: {
        _fileMap: {
            [path: string]: InstanceType<Constructor>;
        };
        _changedFiles: Set<string>;
        _changedRegistered: Set<InstanceType<Constructor>>;
        [key: string]: any;
    };
    redis: Redis;
}

interface Constructor {
    new (...args: any[]): any;
}
