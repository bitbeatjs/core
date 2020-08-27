enum Status {
    exit = 'exited',
    shutdown = 'shutdown',
    stopped = 'stopped',
    stopping = 'stopping',
    starting = 'starting',
    started = 'started',
    initializing = 'initializing',
    initialized = 'initialized',
    providing = 'providing',
    provided = 'provided',
    registering = 'registering',
    registered = 'registered',
    configuring = 'configuring',
    configured = 'configured',
    restarting = 'restarting',
    restarted = 'restarted',
    connected = 'connected',
    disconnected = 'disconnected',
}

export default Status;
