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
    };
    public busy = false;

    constructor(
        options: {
            start: () => Promise<void>;
            restart: () => Promise<void>;
            shutdown: () => Promise<void>;
            timeout: number;
        }
    ) {
        this.options = options;

        this.signals.forEach((signal): void => {
            const handleListener = (signal: NodeJS.Signals): void => {
                if (this.busy) {
                    return;
                }

                this.busy = true;
                const timer = setTimeout(() => {
                    process.removeListener(signal, handleListener);
                    console.error('Timeout while cleaning up.');
                    process.exit(1);
                }, this.options.timeout);

                (async () => {
                    try {
                        await this.options.shutdown();
                        clearTimeout(timer);
                        process.removeListener(signal, handleListener);
                        process.exit(0);
                    } catch (e) {
                        process.removeListener(signal, handleListener);
                        console.error(e);
                        process.exit(1);
                    }
                })();
            };
            process.addListener(signal as NodeJS.Signals, handleListener);
        });

        return this.initialize() as any;
    }

    async initialize(): Promise<void> {
        await this.options.start();
    }
}
