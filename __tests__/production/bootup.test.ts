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
    t.pass();
});

test.serial('should boot in less than 500 ms without a store', async t => {
    await boot.start();
    t.true(store.getBootTime() < 500, `Actual time was ${ms(store.getBootTime(), { long: true })}.`);
});

test.serial('should reboot in less than 500 ms without a store', async t => {
    await boot.restart();
    t.true(store.getBootTime() < 500, `Actual time was ${ms(store.getBootTime(), { long: true })}.`);
});

test.serial('should reboot in less than 500 ms with a new store', async t => {
    await boot.stop();
    const s = new Store(boot, {
        instanceName: boot.name,
        logLevel: boot.logLevel,
    });
    await boot.init(s);
    await boot.start();
    t.true(store.getBootTime() < 500, `Actual time was ${ms(store.getBootTime(), { long: true })}.`);
});

test.serial('should not have a file watcher', async t => {
    t.true(!store.watcher);
});

test.after(async t => {
    await boot.shutdown();
    t.pass();
});