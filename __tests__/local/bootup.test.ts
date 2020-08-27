import {
    Store,
    Boot,
} from '../../index';
import test from 'ava';
import ms from 'ms';
let boot: Boot, store: Store;

test.before(async t => {
    boot = new Boot();
    await boot.init();
    store = boot.store;
    await boot.start();
});

test.serial('should boot in less than 100 ms without a store', async t => {
    t.true(store.getBootTime() < 100, `Actual time was ${ms(store.getBootTime(), { long: true })}.`);
});

test.serial('should reboot in less than 100 ms without a store', async t => {
    await boot.restart();
    t.true(store.getBootTime() < 100, `Actual time was ${ms(store.getBootTime(), { long: true })}.`);
});

test.serial('should reboot in less than 100 ms with a new store', async t => {
    await boot.stop();
    await boot.store.close();
    const s = new Store({
        prefix: boot.name,
        baseDir: boot.baseDir,
        config: boot.getConfig(),
        instanceName: boot.name,
        logLevel: boot.logLevel,
    });
    await boot.init(s);
    await boot.start();
    store = boot.store;
    t.true(store.getBootTime() < 100, `Actual time was ${ms(store.getBootTime(), { long: true })}.`);
});

test.serial('should have a file watcher', async t => {
    t.true(!!store.watcher);
});

test.after(async t => {
    await boot.shutdown();
});