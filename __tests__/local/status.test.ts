import {
    Store,
    Boot,
    Server,
    Configuration,
    Status,
} from '../../index';
import test from 'ava';
let boot: Boot, store: Store;

class TestServer extends Server {
    constructor() {
        super();
    }

    async configure() {
        store.logger.info('I will run once.');
    }

    async start() {
        store.logger.info('Started.');
    }

    async stop() {
        store.logger.info('Stopped.');
    }
}

class TestConfiguration extends Configuration {
    constructor() {
        super();
    }

    async configure() {
        store.logger.info('I will run once.');
    }
}

test.before(async t => {
    boot = new Boot();
    await boot.init();
    store = boot.store;
    await boot.start();
    t.pass();
});

test.serial('should create a new automatic server and register it and subscribe to the states.', async t => {
    const testServer = await store.register(TestServer, true);
    testServer.subscribe(Status.started, (state: boolean) => {
        if (!state) {
            return;
        }

        console.log(state)
        t.pass();
    }, true);
});

test.after(async t => {
    await boot.shutdown();
    t.pass();
});