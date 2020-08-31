export default interface Cache {
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
