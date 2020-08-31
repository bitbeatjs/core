import {
    Store,
    Boot,
    Server,
    Configuration,
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

test.serial('should create a new automatic server and register it', async t => {
    await store.register(TestServer, true);
    const testServer = store.getInstance(TestServer);
    t.true(!!testServer && testServer instanceof TestServer);
});

test.serial('should create a new automatic configuration and register it', async t => {
    await store.register(TestConfiguration, true);
    const testConfig = store.getInstance(TestConfiguration);
    t.true(!!testConfig && testConfig instanceof TestConfiguration);
});

test.serial('should update the server and use the new config and re-register it', async t => {
    const testServer = store.getInstance(TestServer);
    const newTestServer = testServer;

    if (!newTestServer) {
        throw new Error('Could not find server.');
    }

    newTestServer.start = async () => {
        const testConfig = store.getInstance(TestConfiguration);
        console.log(testConfig?.value.name);
        console.log('Started.');
    };
    await store.registerUpdate(testServer, newTestServer);
    t.true(
        !!newTestServer && newTestServer instanceof TestServer && testServer === newTestServer,
        `Actually exists and is equal to the old instance, but with updates in it.`
    );
});

test.serial('should delete the server and the config', async t => {
    let testServer = store.getInstance(TestServer);
    let testConfig = store.getInstance(TestConfiguration);
    store.removeInstances(new Set([testServer, testConfig]));
    testServer = store.getInstance(TestServer);
    testConfig = store.getInstance(TestConfiguration);
    t.true(!testServer && !testConfig);
});

test.after(async t => {
    await boot.shutdown();
    t.pass();
});