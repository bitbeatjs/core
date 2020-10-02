import { Debugger } from 'debug';
import { name } from '../package.json';
import { getEnvVar } from './functions';
import { generateDebugger } from '../bin/bootup';

export default class Cli {
    private readonly signals: (NodeJS.Signals | string)[] = [
        'SIGINT',
        'SIGTERM',
        'exit',
        'SIGBREAK',
    ];
    public options: {
        start: () => Promise<void>;
        restart: () => Promise<void>;
        shutdown: () => Promise<void>;
        timeout: number;
        keepAlive?: boolean;
    };
    public busy = false;
    public stop = false;
    public debug: Debugger | any;

    constructor(options: {
        start: () => Promise<void>;
        restart: () => Promise<void>;
        shutdown: () => Promise<void>;
        timeout: number;
        keepAlive?: boolean;
    }) {
        this.options = options;

        if (!Object.prototype.hasOwnProperty.call(this.options, 'keepAlive')) {
            this.options.keepAlive = true;
        }

        this.signals.forEach((sig): void => {
            const handleListener = (signal: NodeJS.Signals): void => {
                if (this.busy) {
                    return;
                }

                this.busy = true;
                this.stop = sig !== 'exit';
                const timer = setTimeout(() => {
                    process.emit('beforeExit', 1);
                    process.removeListener(signal, handleListener);
                    console.error('Timeout while cleaning up.');
                    process.exit(1);
                }, this.options.timeout);

                if (this.debug) {
                    this.debug(
                        `Signal '${sig}' ${
                            sig !== signal ? `with code '${signal}' ` : ''
                        }incoming.`
                    );
                }

                (async () => {
                    try {
                        process.emit('beforeExit', 0);
                        await this.options.shutdown();
                        process.emit('beforeExit', 0);
                        clearTimeout(timer);
                        process.removeListener(signal, handleListener);
                        process.exit(0);
                    } catch (e) {
                        process.emit('beforeExit', 1);
                        process.removeListener(signal, handleListener);
                        console.error(e);
                        process.exit(1);
                    }
                })();
            };
            process.addListener(sig as NodeJS.Signals, handleListener);
        });

        return this.initialize() as any;
    }

    async initialize(): Promise<void> {
        await this.options.start();
        this.debug = generateDebugger('cli');
        this.debug(`Finished booting ${name}.`);

        if (
            !this.options.keepAlive ||
            (getEnvVar('KEEP_ALIVE') !== undefined &&
                !getEnvVar('KEEP_ALIVE', true))
        ) {
            this.debug(`Keep alive disabled.`);
            return;
        }

        this.debug(`Keep alive enabled.`);
        const tick = () => {
            if (!this.stop) {
                setImmediate(tick);
            }
        };
        tick();
    }
}
